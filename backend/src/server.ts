import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 4000;

// ── Socket.IO for WebRTC signalling ─────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: { origin: true, credentials: true },
  path: '/socket.io',
});

// Simple WebSocket upgrade for /signal path (raw WS for the video room)
// We use Socket.IO rooms keyed by bookingId
const rooms = new Map<string, Set<string>>(); // roomId -> Set<socketId>

io.on('connection', (socket) => {
  const { room: bookingId, token } = socket.handshake.query as Record<string, string>;
  if (!bookingId) { socket.disconnect(); return; }

  // Validate JWT
  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    socket.emit('error', { message: 'Invalid token' });
    socket.disconnect();
    return;
  }

  // Join the booking room
  socket.join(bookingId);
  const members = rooms.get(bookingId) ?? new Set();
  const isInitiator = members.size === 0;
  members.add(socket.id);
  rooms.set(bookingId, members);

  socket.emit('joined', { isInitiator });
  if (!isInitiator) {
    socket.to(bookingId).emit('peer-joined', { socketId: socket.id });
  }

  // Relay WebRTC signals
  socket.on('offer', (sdp) => socket.to(bookingId).emit('offer', { sdp }));
  socket.on('answer', (sdp) => socket.to(bookingId).emit('answer', { sdp }));
  socket.on('ice', (candidate) => socket.to(bookingId).emit('ice', { candidate }));

  // Chat relay
  socket.on('chat', ({ text }) => {
    socket.to(bookingId).emit('chat', { text, senderName: 'Lesson partner', ts: Date.now() });
  });

  socket.on('disconnect', () => {
    const m = rooms.get(bookingId);
    if (m) { m.delete(socket.id); if (m.size === 0) rooms.delete(bookingId); }
    socket.to(bookingId).emit('peer-left');
  });
});

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key';

// Initialize Database Connection Pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Basic Health Check Route
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'QuickTutor backend running!' });
});

// AUTH: Signup Endpoint
app.post('/api/auth/signup', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password, fullName, role,
            phone, location, bio,
            schoolName, level, studentExam, guardianPhone,
            headline, yearsExperience, hourlyRate, primarySubject, examTypes, languages, certificateUrl } = req.body;
    const password_hash = await bcrypt.hash(password, 10);
    const userRes = await pool.query(
      'INSERT INTO local_users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, password_hash]
    );
    const user = userRes.rows[0];
    await pool.query(
      'INSERT INTO profiles (id, full_name, role, phone, bio) VALUES ($1, $2, $3, $4, $5)',
      [user.id, fullName, role, phone || null, bio || null]
    );

    // Extra profile data
    if (role === 'student') {
      try {
        await pool.query(
          `INSERT INTO student_profiles (user_id, school_name, level, exam_type, location, guardian_phone)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id) DO UPDATE
           SET school_name=$2, level=$3, exam_type=$4, location=$5, guardian_phone=$6`,
          [user.id, schoolName || null, level || null, studentExam || null, location || null, guardianPhone || null]
        );
      } catch { /* table may not exist yet */ }
    } else if (role === 'teacher') {
      try {
        await pool.query(
          `ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS certificate_url TEXT;`
        ).catch(() => {});
        await pool.query(
          `INSERT INTO teacher_profiles (user_id, video_url, background, hourly_rate_cents, years_experience, location, exam_types, languages, certificate_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (user_id) DO UPDATE
           SET video_url=$2, background=$3, hourly_rate_cents=$4, years_experience=$5, location=$6, exam_types=$7, languages=$8, certificate_url=$9`,
          [user.id, headline || null, location || null,
           Math.round((Number(hourlyRate) || 0) * 100),
           Number(yearsExperience) || 0,
           location || null,
           JSON.stringify(examTypes ?? []),
           JSON.stringify(languages ?? ['English']),
           certificateUrl || null]
        );
        if (primarySubject) {
          await pool.query(
            `UPDATE teacher_profiles SET primary_subject_id=$1 WHERE user_id=$2`,
            [primarySubject, user.id]
          );
        }
      } catch { /* table may not exist yet */ }
    }

    const token = jwt.sign({ id: user.id, role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ message: 'Signup successful', token, user: { id: user.id, email: user.email, role } });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    return res.status(500).json({ error: err.message });
  }
});

// AUTH: Login Endpoint
app.post('/api/auth/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;
    const userRes = await pool.query('SELECT * FROM local_users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
    const profileRes = await pool.query('SELECT role FROM profiles WHERE id = $1', [user.id]);
    const role = profileRes.rows[0]?.role || 'student';
    const token = jwt.sign({ id: user.id, role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ message: 'Login successful', token, user: { id: user.id, email: user.email, role } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// AUTH: Forgot Password
app.post('/api/auth/forgot-password', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;
    const userRes = await pool.query('SELECT * FROM local_users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    if (!user) return res.json({ message: 'If email exists, reset link sent.' });
    
    // Generate a short-lived token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
    
    // Mock sending email
    console.log(`\n\n[MOCK EMAIL] Password reset link for ${email}: \nhttp://localhost:5173/forgot-password?token=${token}\n\n`);
    
    res.json({ message: 'If email exists, reset link sent.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AUTH: Reset Password
app.post('/api/auth/reset-password', async (req: Request, res: Response): Promise<any> => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Missing token or newPassword' });
    
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const password_hash = await bcrypt.hash(newPassword, 10);
    
    await pool.query('UPDATE local_users SET password_hash = $1 WHERE id = $2', [password_hash, decoded.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err: any) {
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});

// AUTH: Middleware
const requireAuth = (req: Request, res: Response, next: NextFunction): any => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req: Request, res: Response, next: NextFunction): any => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin only' });
  }
  next();
};

app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: (req as any).user });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// ── NOTIFICATIONS ────────────────────────────────────────────────────────────
app.get('/api/notifications', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { rows } = await pool.query(
      'SELECT id, title, message, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    res.json({ notifications: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── TEACHER DASHBOARD ────────────────────────────────────────────────────────
app.get('/api/teacher/dashboard', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const [
      { rows: subjects },
      { rows: topics },
      { rows: teacherProfile },
      { rows: profile },
      { rows: teacherTopics },
      { rows: bookings },
      { rows: availability },
      { rows: notifications },
      { rows: ratings },
    ] = await Promise.all([
      pool.query('SELECT id, name FROM subjects ORDER BY name'),
      pool.query('SELECT id, name, subject_id FROM topics ORDER BY name'),
      pool.query('SELECT * FROM teacher_profiles WHERE user_id = $1', [userId]),
      pool.query('SELECT bio FROM profiles WHERE id = $1', [userId]),
      pool.query('SELECT topic_id, is_specialty FROM teacher_topics WHERE teacher_id = $1', [userId]),
      pool.query('SELECT b.id, b.scheduled_at, b.status, b.price_cents, p.full_name as student_name FROM bookings b JOIN profiles p ON b.student_id = p.id WHERE b.teacher_id = $1 ORDER BY b.scheduled_at DESC', [userId]),
      pool.query('SELECT id, day_of_week, start_hour, end_hour FROM teacher_availability WHERE teacher_id = $1 ORDER BY day_of_week', [userId]),
      pool.query('SELECT id, title, message, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId]),
      pool.query('SELECT r.id, r.stars, r.comment, r.created_at, p.full_name as student_name FROM ratings r JOIN profiles p ON r.student_id = p.id WHERE r.teacher_id = $1 ORDER BY r.created_at DESC LIMIT 5', [userId]),
    ]);
    res.json({
      subjects, topics,
      teacherProfile: teacherProfile[0] || null,
      bio: profile[0]?.bio || '',
      teacherTopics,
      bookings: bookings.map(b => ({ ...b, profiles: { full_name: b.student_name } })),
      availability,
      notifications,
      reviews: ratings.map(r => ({ ...r, profiles: { full_name: r.student_name } })),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/teacher/profile', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { headline, rate, years, primarySubject, location, examTypes, bio, selectedTopics, specialties } = req.body;
    try {
      await pool.query(
        `INSERT INTO teacher_profiles (user_id, video_url, background, hourly_rate_cents, years_experience, location, exam_types)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (user_id) DO UPDATE
         SET video_url=$2, background=$3, hourly_rate_cents=$4, years_experience=$5, location=$6, exam_types=$7`,
        [userId, headline, location, Math.round((Number(rate) || 0) * 100), Number(years) || 0, location, JSON.stringify(examTypes ?? [])]
      );
      if (primarySubject) {
        await pool.query('UPDATE teacher_profiles SET primary_subject_id=$1 WHERE user_id=$2', [primarySubject, userId]);
      }
    } catch (e) { /* silent */ }
    await pool.query('UPDATE profiles SET bio = $1 WHERE id = $2', [bio, userId]);
    await pool.query('DELETE FROM teacher_topics WHERE teacher_id = $1', [userId]);
    for (const tid of (selectedTopics ?? [])) {
      await pool.query('INSERT INTO teacher_topics (teacher_id, topic_id, is_specialty) VALUES ($1, $2, $3)', [userId, tid, (specialties ?? []).includes(tid)]);
    }
    res.json({ message: 'Profile updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/teacher/availability', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { availability } = req.body;
    await pool.query('DELETE FROM teacher_availability WHERE teacher_id = $1', [userId]);
    for (const a of (availability ?? [])) {
      await pool.query('INSERT INTO teacher_availability (teacher_id, day_of_week, start_hour, end_hour) VALUES ($1,$2,$3,$4)', [userId, a.day_of_week, a.start_hour, a.end_hour]);
    }
    res.json({ message: 'Availability saved' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Update booking status (for teacher to confirm)
app.put('/api/teacher/bookings/:id/status', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await pool.query('UPDATE bookings SET status=$1 WHERE id=$2', [status, id]);
    res.json({ message: 'Status updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── STUDENT DASHBOARD ────────────────────────────────────────────────────────
app.get('/api/student/dashboard', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { rows: bookings } = await pool.query(
      'SELECT b.id, b.scheduled_at, b.status, b.price_cents, b.room_id, b.teacher_id, p.full_name as teacher_name FROM bookings b JOIN profiles p ON b.teacher_id = p.id WHERE b.student_id = $1 ORDER BY b.scheduled_at DESC',
      [userId]
    );
    const bookingIds = bookings.map(b => b.id);
    let ratings: any[] = [];
    if (bookingIds.length > 0) {
      const { rows } = await pool.query('SELECT booking_id FROM ratings WHERE booking_id = ANY($1::uuid[])', [bookingIds]);
      ratings = rows;
    }
    res.json({
      bookings: bookings.map(b => ({ ...b, profiles: { full_name: b.teacher_name } })),
      ratedIds: ratings.map(r => r.booking_id),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/student/bookings/:id/cancel', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    await pool.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [req.params.id]);
    res.json({ message: 'Booking cancelled' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/student/bookings/:id/reschedule', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    await pool.query('UPDATE bookings SET scheduled_at=$1 WHERE id=$2', [req.body.scheduled_at, req.params.id]);
    res.json({ message: 'Booking rescheduled' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/student/bookings/:id/review', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const studentId = (req as any).user.id;
    const { teacher_id, stars, comment } = req.body;
    await pool.query(
      'INSERT INTO ratings (booking_id, teacher_id, student_id, stars, comment) VALUES ($1,$2,$3,$4,$5)',
      [req.params.id, teacher_id, studentId, stars, comment]
    );
    res.json({ message: 'Review submitted' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Favorites
app.get('/api/student/favorites', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { rows } = await pool.query('SELECT teacher_id FROM favorites WHERE student_id=$1', [userId]);
    res.json({ favorites: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/student/favorites', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    await pool.query('INSERT INTO favorites (student_id, teacher_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, req.body.teacher_id]);
    res.json({ message: 'Added to favorites' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/student/favorites', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    await pool.query('DELETE FROM favorites WHERE student_id=$1 AND teacher_id=$2', [userId, req.body.teacher_id]);
    res.json({ message: 'Removed from favorites' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── PUBLIC SEARCH ────────────────────────────────────────────────────────────
app.get('/api/subjects', async (_req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM subjects ORDER BY name');
    res.json({ subjects: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/teachers', async (req: Request, res: Response): Promise<any> => {
  try {
    const { subjectId, examType, location, maxPrice } = req.query;
    let query = `
      SELECT t.user_id, t.video_url as headline, t.hourly_rate_cents, t.background as location, t.exam_types, t.verification_status,
             t.years_experience, p.full_name, p.avatar_url, s.name as subject_name
      FROM teacher_profiles t
      LEFT JOIN profiles p ON t.user_id = p.id
      LEFT JOIN subjects s ON t.primary_subject_id = s.id
      WHERE t.is_active = true
    `;
    const params: any[] = [];
    let paramIndex = 1;
    if (subjectId) { query += ` AND t.primary_subject_id = $${paramIndex++}`; params.push(subjectId); }
    if (examType) { query += ` AND t.exam_types::text LIKE $${paramIndex++}`; params.push(`%${examType}%`); }
    if (location) { query += ` AND t.background = $${paramIndex++}`; params.push(location); }
    if (maxPrice) { query += ` AND t.hourly_rate_cents <= $${paramIndex++}`; params.push(parseInt(maxPrice as string) * 100); }
    const { rows: teachers } = await pool.query(query, params);
    if (teachers.length > 0) {
      const ids = teachers.map(t => t.user_id);
      const { rows: ratings } = await pool.query('SELECT teacher_id, stars FROM ratings WHERE teacher_id = ANY($1::uuid[])', [ids]);
      const agg = new Map<string, { sum: number; n: number }>();
      ratings.forEach(r => { const a = agg.get(r.teacher_id) || { sum: 0, n: 0 }; a.sum += r.stars; a.n++; agg.set(r.teacher_id, a); });
      teachers.forEach(t => {
        const a = agg.get(t.user_id);
        t.avg_stars = a ? a.sum / a.n : null;
        t.review_count = a?.n ?? 0;
        t.profiles = { full_name: t.full_name, avatar_url: t.avatar_url };
        t.subjects = { name: t.subject_name };
      });
    }
    res.json({ teachers });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/teachers/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const [{ rows: tp }, { rows: topics }, { rows: availability }, { rows: ratings }] = await Promise.all([
      pool.query(`SELECT t.user_id, t.video_url as headline, t.hourly_rate_cents, t.years_experience, t.background as location,
                  t.verification_status, t.exam_types, p.full_name, p.bio, p.avatar_url, s.name as subject_name
                  FROM teacher_profiles t LEFT JOIN profiles p ON t.user_id=p.id LEFT JOIN subjects s ON t.primary_subject_id=s.id
                  WHERE t.user_id=$1`, [req.params.id]),
      pool.query(`SELECT tt.is_specialty, tp.id as topic_id, tp.name as topic_name FROM teacher_topics tt JOIN topics tp ON tt.topic_id=tp.id WHERE tt.teacher_id=$1`, [req.params.id]),
      pool.query('SELECT day_of_week, start_hour, end_hour FROM teacher_availability WHERE teacher_id=$1 ORDER BY day_of_week, start_hour', [req.params.id]),
      pool.query('SELECT r.stars, r.comment, b.scheduled_at, b.location FROM ratings r LEFT JOIN bookings b ON r.booking_id=b.id WHERE r.teacher_id=$1 ORDER BY r.created_at DESC LIMIT 5', [req.params.id]),
    ]);
    if (!tp.length) return res.status(404).json({ error: 'Teacher not found' });
    const t = tp[0];
    res.json({
      t: { user_id: t.user_id, headline: t.headline, hourly_rate_cents: t.hourly_rate_cents, years_experience: t.years_experience, location: t.location, verification_status: t.verification_status, exam_types: t.exam_types, profiles: { full_name: t.full_name, bio: t.bio, avatar_url: t.avatar_url }, subjects: { name: t.subject_name } },
      topics: topics.map(tp => ({ id: tp.topic_id, name: tp.topic_name, is_specialty: tp.is_specialty })),
      availability,
      ratings: ratings.map(r => ({ stars: r.stars, comment: r.comment, bookings: { scheduled_at: r.scheduled_at, location: r.location } })),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/teacher/:id/availability', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query('SELECT day_of_week, start_hour, end_hour FROM teacher_availability WHERE teacher_id=$1 ORDER BY day_of_week', [req.params.id]);
    res.json({ data: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Taken slots for a teacher
app.get('/api/teacher/:id/bookings-taken', async (req: Request, res: Response): Promise<any> => {
  try {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setDate(from.getDate() + 7);
    const { rows } = await pool.query(
      `SELECT scheduled_at FROM bookings WHERE teacher_id=$1 AND status IN ('pending','confirmed') AND scheduled_at >= $2 AND scheduled_at < $3`,
      [req.params.id, from.toISOString(), to.toISOString()]
    );
    res.json({ taken: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Create booking — returns booking_id
app.post('/api/student/bookings', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const studentId = (req as any).user.id;
    const { teacher_id, topic_id, scheduled_at, duration_minutes, price_cents, location } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO bookings (student_id, teacher_id, topic_id, scheduled_at, duration_minutes, price_cents, status, location)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING id`,
      [studentId, teacher_id, topic_id || null, scheduled_at, duration_minutes || 60, price_cents, location || 'Online']
    );
    res.json({ message: 'Booking created', booking_id: rows[0].id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Get booking detail (for room access)
app.get('/api/bookings/:id', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { rows } = await pool.query(
      'SELECT b.*, p.full_name as student_name, pt.full_name as teacher_name FROM bookings b JOIN profiles p ON b.student_id=p.id JOIN profiles pt ON b.teacher_id=pt.id WHERE b.id=$1',
      [req.params.id]
    );
    const b = rows[0];
    if (!b) return res.status(404).json({ error: 'Not found' });
    if (b.student_id !== userId && b.teacher_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    const otherName = b.student_id === userId ? b.teacher_name : b.student_name;
    res.json({ booking: b, other_name: otherName });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── PAYSTACK ──────────────────────────────────────────────────────────────────
app.post('/api/paystack/initialize', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { booking_id, email } = req.body;
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET || PAYSTACK_SECRET === 'sk_test_placeholder') {
      // Dev fallback — simulate initialization
      return res.json({ authorization_url: null, reference: `dev-ref-${Date.now()}`, access_code: 'dev' });
    }
    const { rows } = await pool.query('SELECT price_cents FROM bookings WHERE id=$1', [booking_id]);
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    const { price_cents } = rows[0];
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, amount: price_cents, currency: 'GHS', metadata: { booking_id } }),
    });
    const data = await paystackRes.json() as any;
    if (!paystackRes.ok || !data.status) return res.status(500).json({ error: 'Paystack initialization failed' });
    await pool.query('UPDATE bookings SET paystack_reference=$1 WHERE id=$2', [data.data.reference, booking_id]);
    res.json({ authorization_url: data.data.authorization_url, reference: data.data.reference, access_code: data.data.access_code });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/paystack/verify', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { reference, booking_id } = req.body;
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET || PAYSTACK_SECRET === 'sk_test_placeholder') {
      // Dev fallback — confirm immediately
      await pool.query("UPDATE bookings SET status='confirmed' WHERE id=$1", [booking_id]);
      return res.json({ message: 'Payment verified (dev mode)', confirmed: true });
    }
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const data = await verifyRes.json() as any;
    if (!verifyRes.ok || data?.data?.status !== 'success') {
      return res.status(400).json({ error: 'Payment not successful', status: data?.data?.status });
    }
    await pool.query("UPDATE bookings SET status='confirmed', paystack_reference=$1 WHERE id=$2", [reference, booking_id]);
    res.json({ message: 'Payment verified, booking confirmed', confirmed: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Ratings
app.post('/api/ratings', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { booking_id, teacher_id, stars, comment } = req.body;
    const student_id = (req as any).user.id;
    
    await pool.query(
      `INSERT INTO ratings (booking_id, student_id, teacher_id, stars, comment) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (booking_id) DO NOTHING`,
      [booking_id, student_id, teacher_id, stars, comment || null]
    );
    
    res.json({ message: 'Rating submitted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
app.get('/api/admin/stats', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const [{ rows: userCountRes }, { rows: bookingsRes }] = await Promise.all([
      pool.query('SELECT count(*) as count FROM profiles'),
      pool.query('SELECT status, price_cents FROM bookings')
    ]);
    const users = parseInt(userCountRes[0].count, 10) || 0;
    const bookings = bookingsRes.length;
    const revenueCents = bookingsRes.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.price_cents || 0), 0);
    res.json({ users, bookings, revenueCents });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/bookings', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query('SELECT id, scheduled_at, status, price_cents FROM bookings ORDER BY created_at DESC LIMIT 20');
    res.json({ bookings: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/transactions', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    try {
      const { rows } = await pool.query('SELECT id, amount_cents, status, currency, created_at FROM transactions ORDER BY created_at DESC LIMIT 20');
      res.json({ transactions: rows });
    } catch {
      res.json({ transactions: [] });
    }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query('SELECT id, full_name, created_at FROM profiles ORDER BY created_at DESC LIMIT 20');
    res.json({ users: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/verifications', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query(
      `SELECT t.user_id, t.id_document_url, t.qualification_document_url, p.full_name as full_name 
       FROM teacher_profiles t 
       JOIN profiles p ON t.user_id = p.id 
       WHERE t.verification_status = 'pending'`
    );
    const mapped = rows.map(r => ({
      user_id: r.user_id,
      id_document_url: r.id_document_url,
      qualification_document_url: r.qualification_document_url,
      profiles: { full_name: r.full_name }
    }));
    res.json({ pending: mapped });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/verifications/:userId', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    const { approve, notes } = req.body;
    const status = approve ? 'verified' : 'rejected';
    const verifiedAt = approve ? new Date().toISOString() : null;
    await pool.query(
      `UPDATE teacher_profiles 
       SET verification_status = $1, verified_at = $2, verification_notes = $3 
       WHERE user_id = $4`,
      [status, verifiedAt, notes, userId]
    );
    res.json({ message: 'Verification status updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── FRONTEND SERVING ──────────────────────────────────────────────────────────
const frontendPath = path.join(__dirname, '../../dist');
app.use(express.static(frontendPath));
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start server (using httpServer for Socket.IO)
httpServer.listen(port, () => {
  console.log(`🚀 QuickTutor Backend running at http://localhost:${port}`);
  console.log(`📡 WebRTC signalling via Socket.IO active`);
});
