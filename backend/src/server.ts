import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import {
  sendSms,
  sendBookingCreatedSms,
  sendPaymentConfirmedSms,
  sendBookingCancelledSms,
  sendPayoutRemittedSms,
  sendSupportResolvedSms,
  sendAdminPaymentAlertSms,
  sendLessonPriorReminderSms,
} from './sms';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key';

// ── Rate Limiters for Security & Abuse Prevention ────────────────────────────
// Rate limiter for authentication attempts (Login, Signup, Password Reset)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' }
});

// Rate limiter for outbound SMS operations to prevent credit exhaustion
export const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many SMS requests. Please wait a few minutes before trying again.' }
});

// ── Socket.IO for WebRTC signalling ─────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: { origin: true, credentials: true },
  path: '/socket.io',
});

// Rooms keyed by bookingId -> Set of socket IDs
const rooms = new Map<string, Set<string>>();

io.on('connection', async (socket) => {
  const { room: bookingId, token } = socket.handshake.query as Record<string, string>;
  if (!bookingId) { socket.disconnect(); return; }

  // 1. Validate JWT Token
  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    socket.emit('error', { message: 'Invalid or expired session token' });
    socket.disconnect();
    return;
  }

  // 2. Validate booking existence, payment confirmation, AND participant ownership
  try {
    const { rows: bCheck } = await pool.query(
      'SELECT status, student_id, teacher_id FROM bookings WHERE id = $1',
      [bookingId]
    );
    if (!bCheck.length) {
      socket.emit('error', { message: 'Booking not found' });
      socket.disconnect();
      return;
    }

    const booking = bCheck[0];
    if (booking.status === 'pending') {
      socket.emit('error', { message: 'Payment required before entering live classroom' });
      socket.disconnect();
      return;
    }

    // Strict Anti-IDOR: verify connecting user is either the assigned student, tutor, or admin
    const userId = decoded.id;
    const userRole = decoded.role;
    if (booking.student_id !== userId && booking.teacher_id !== userId && userRole !== 'admin') {
      socket.emit('error', { message: 'Forbidden: You are not authorized to join this private classroom' });
      socket.disconnect();
      return;
    }
  } catch {
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

// Initialize Database Connection Pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Basic Health Check Route
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'QuickTutor backend running!' });
});

// Auto-migrate missing columns and tables
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const { rows: subRows } = await pool.query('SELECT COUNT(*) FROM subjects');
    if (parseInt(subRows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO subjects (name) VALUES
        ('Core Mathematics'),
        ('Integrated Science'),
        ('English Language'),
        ('Social Studies'),
        ('Physics'),
        ('Chemistry'),
        ('Biology'),
        ('Elective Mathematics'),
        ('Information & Communication Tech (ICT)'),
        ('Economics'),
        ('Financial Accounting'),
        ('Cost Accounting'),
        ('Business Management'),
        ('Government'),
        ('Geography'),
        ('History'),
        ('French'),
        ('Literature in English')
        ON CONFLICT (name) DO NOTHING;
      `);
      console.log('✅ Default Ghanaian subjects seeded automatically.');
    }

    await pool.query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;');
    await pool.query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;');
    await pool.query(`
      ALTER TABLE teacher_profiles 
      ADD COLUMN IF NOT EXISTS hourly_rate_cents INTEGER DEFAULT 4000,
      ADD COLUMN IF NOT EXISTS years_experience INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS location TEXT,
      ADD COLUMN IF NOT EXISTS exam_types JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS primary_subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);
    await pool.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS paystack_reference TEXT,
      ADD COLUMN IF NOT EXISTS paid_out BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS reminded_30m BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS reminded_5m BOOLEAN DEFAULT false;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (student_id, teacher_id)
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
        student_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT DEFAULT 'GHS',
        paystack_reference TEXT,
        status TEXT DEFAULT 'pending',
        transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS paystack_reference TEXT,
      ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);
    // Drop legacy Stripe columns if they exist & backfill paystack_reference
    await pool.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='stripe_payment_intent') THEN
          UPDATE transactions SET paystack_reference = stripe_payment_intent WHERE paystack_reference IS NULL AND stripe_payment_intent IS NOT NULL;
          ALTER TABLE transactions DROP COLUMN IF EXISTS stripe_payment_intent;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='stripe_session_id') THEN
          ALTER TABLE transactions DROP COLUMN IF EXISTS stripe_session_id;
        END IF;
      END $$;
    `);
    // Backfill student_id and transaction_date on existing transactions
    await pool.query(`
      UPDATE transactions t
      SET student_id = b.student_id
      FROM bookings b
      WHERE t.booking_id = b.id AND t.student_id IS NULL;

      UPDATE transactions
      SET transaction_date = created_at
      WHERE transaction_date IS NULL;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tutor_subjects (
        teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (teacher_id, subject_id)
      );
    `);
    // Backfill tutor_subjects from teacher_topics and primary_subject_id
    await pool.query(`
      INSERT INTO tutor_subjects (teacher_id, subject_id)
      SELECT DISTINCT tt.teacher_id, t.subject_id
      FROM teacher_topics tt
      JOIN topics t ON tt.topic_id = t.id
      ON CONFLICT DO NOTHING;

      INSERT INTO tutor_subjects (teacher_id, subject_id)
      SELECT tp.user_id, tp.primary_subject_id
      FROM teacher_profiles tp
      WHERE tp.primary_subject_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS room_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
        room_id TEXT NOT NULL,
        host_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'active',
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP WITH TIME ZONE
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        amount_cents INTEGER NOT NULL,
        paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        participant_one UUID REFERENCES profiles(id) ON DELETE CASCADE,
        participant_two UUID REFERENCES profiles(id) ON DELETE CASCADE,
        last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (participant_one, participant_two)
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
        sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
        category TEXT NOT NULL,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        resolution_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP WITH TIME ZONE
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'general',
        link TEXT,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE notifications 
      ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general',
      ADD COLUMN IF NOT EXISTS link TEXT,
      ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
    `);
  } catch (e) {
    console.error("Migration error:", e);
  }
})();

// AUTH: Signup Endpoint
app.post('/api/auth/signup', authLimiter, async (req: Request, res: Response): Promise<any> => {
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
    try {
      await pool.query(
        'INSERT INTO profiles (id, full_name, role, phone, bio) VALUES ($1, $2, $3, $4, $5)',
        [user.id, fullName, role, phone || null, bio || null]
      );
    } catch (e: any) {
      // If profile fails, delete the user to prevent orphaned accounts
      await pool.query('DELETE FROM local_users WHERE id = $1', [user.id]);
      throw e;
    }

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
app.post('/api/auth/login', authLimiter, async (req: Request, res: Response): Promise<any> => {
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
app.post('/api/auth/forgot-password', authLimiter, async (req: Request, res: Response): Promise<any> => {
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
app.post('/api/auth/reset-password', authLimiter, async (req: Request, res: Response): Promise<any> => {
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

// ── NOTIFICATIONS HELPER & ENDPOINTS ──────────────────────────────────────────
async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'payment' | 'message' | 'support' | 'booking' | 'general' = 'general',
  link?: string
) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, title, message, type, link || null]
    );
  } catch (err) {
    console.error('Error creating notification:', err);
  }
}

app.get('/api/notifications', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    let { rows } = await pool.query(
      'SELECT id, title, message, type, link, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [userId]
    );

    // If no notifications exist yet, generate contextual notifications from their existing records
    if (rows.length === 0) {
      // Check bookings
      const { rows: userBookings } = await pool.query(
        `SELECT b.*, p.full_name as other_name 
         FROM bookings b 
         JOIN profiles p ON (CASE WHEN b.student_id = $1 THEN b.teacher_id ELSE b.student_id END) = p.id
         WHERE b.student_id = $1 OR b.teacher_id = $1
         ORDER BY b.scheduled_at DESC LIMIT 3`,
        [userId]
      );
      for (const b of userBookings) {
        if (b.status === 'completed') {
          if (b.teacher_id === userId) {
            await createNotification(
              userId,
              'Lesson Completed · Payout Queued',
              `Lesson with ${b.other_name} was completed. Net payout: GHS ${((b.price_cents * 0.85) / 100).toFixed(2)} (after 15% deduction).`,
              'payment',
              '/dashboard/teacher'
            );
          } else {
            await createNotification(
              userId,
              'Lesson Completed',
              `Your session with ${b.other_name} was completed!`,
              'booking',
              '/dashboard/student'
            );
          }
        } else if (b.status === 'confirmed') {
          await createNotification(
            userId,
            'Confirmed Session',
            `You have a confirmed lesson with ${b.other_name} on ${new Date(b.scheduled_at).toLocaleString()}.`,
            'booking',
            b.student_id === userId ? '/dashboard/student' : '/dashboard/teacher'
          );
        }
      }

      // Check support tickets
      const { rows: userTickets } = await pool.query(
        'SELECT * FROM support_tickets WHERE reporter_id = $1 ORDER BY created_at DESC LIMIT 3',
        [userId]
      );
      for (const t of userTickets) {
        if (t.status === 'resolved') {
          await createNotification(
            userId,
            'Support Ticket Resolved',
            `Your report "${t.subject}" was resolved by Admin${t.resolution_notes ? `: ${t.resolution_notes}` : ''}.`,
            'support',
            '/dashboard'
          );
        } else {
          await createNotification(
            userId,
            'Support Ticket Under Review',
            `Your report "${t.subject}" is being reviewed by Admin.`,
            'support',
            '/dashboard'
          );
        }
      }

      const refreshed = await pool.query(
        'SELECT id, title, message, type, link, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
        [userId]
      );
      rows = refreshed.rows;
    }

    res.json({ notifications: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/notifications/read-all', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [userId]);
    res.json({ message: 'All notifications marked as read' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/notifications/:id/read', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
    res.json({ message: 'Notification marked as read' });
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
      pool.query('SELECT bio, phone FROM profiles WHERE id = $1', [userId]),
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
      phone: profile[0]?.phone || '',
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
    const { headline, rate, years, primarySubject, location, examTypes, bio, phone, selectedTopics, specialties } = req.body;
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
    await pool.query('UPDATE profiles SET bio = $1, phone = $2 WHERE id = $3', [bio, phone, userId]);
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

app.put('/api/teacher/bookings/:id/status', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // 1. Authorize: Ensure tutor owns this booking (or user is admin)
    const { rows: bRows } = await pool.query(
      `SELECT b.*, sp.full_name as student_name, tp.full_name as teacher_name 
       FROM bookings b 
       JOIN profiles sp ON b.student_id = sp.id 
       JOIN profiles tp ON b.teacher_id = tp.id 
       WHERE b.id = $1`,
      [id]
    );
    if (bRows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const b = bRows[0];
    // Authorize: Either tutor or student associated with the booking (or admin) can update status
    if (b.teacher_id !== userId && b.student_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You are not authorized to update this booking status' });
    }

    await pool.query('UPDATE bookings SET status=$1 WHERE id=$2', [status, id]);

    // Send notifications
    if (status === 'completed') {
      const netGhs = ((b.price_cents * 0.85) / 100).toFixed(2);
      await createNotification(
        b.teacher_id,
        'Lesson Completed · Net Payout Queued',
        `Lesson with ${b.student_name} completed! Net payout of GHS ${netGhs} (85% after 15% platform deduction) is queued for your MoMo payout.`,
        'payment',
        '/dashboard/teacher'
      );
      await createNotification(
        b.student_id,
        'Lesson Completed',
        `Your lesson with ${b.teacher_name} is complete. Please leave a review on your dashboard!`,
        'booking',
        '/dashboard/student'
      );
    } else if (status === 'confirmed') {
      await createNotification(
        b.student_id,
        'Lesson Booking Confirmed',
        `Your tutor ${b.teacher_name} confirmed your lesson for ${new Date(b.scheduled_at).toLocaleString()}.`,
        'booking',
        '/dashboard/student'
      );
    } else if (status === 'cancelled') {
      await createNotification(
        b.student_id,
        'Lesson Cancelled',
        `Your booking with ${b.teacher_name} was cancelled.`,
        'booking',
        '/dashboard/student'
      );
      // Trigger SMS to student
      (async () => {
        try {
          const { rows: stRows } = await pool.query('SELECT full_name, phone FROM profiles WHERE id = $1', [b.student_id]);
          if (stRows.length && stRows[0].phone) {
            await sendBookingCancelledSms({
              phone: stRows[0].phone,
              name: stRows[0].full_name,
              scheduledAt: b.scheduled_at,
              cancelledBy: b.teacher_name || 'Tutor',
            });
          }
        } catch (e) { console.error('SMS cancel error:', e); }
      })();
    }

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
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { rows: existing } = await pool.query(`
      SELECT b.*, sp.full_name as student_name, sp.phone as student_phone, tp.full_name as teacher_name, tp.phone as teacher_phone
      FROM bookings b
      JOIN profiles sp ON b.student_id = sp.id
      JOIN profiles tp ON b.teacher_id = tp.id
      WHERE b.id = $1
    `, [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Booking not found' });
    const b = existing[0];
    if (b.student_id !== userId && b.teacher_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You are not authorized to cancel this booking' });
    }

    await pool.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [req.params.id]);

    // Send SMS notice to the other party
    (async () => {
      try {
        const isCancelledByStudent = b.student_id === userId;
        const targetPhone = isCancelledByStudent ? b.teacher_phone : b.student_phone;
        const targetName = isCancelledByStudent ? b.teacher_name : b.student_name;
        const cancelledByName = isCancelledByStudent ? b.student_name : b.teacher_name;
        if (targetPhone) {
          await sendBookingCancelledSms({
            phone: targetPhone,
            name: targetName,
            scheduledAt: b.scheduled_at,
            cancelledBy: cancelledByName,
          });
        }
      } catch (e) { console.error('SMS cancel notice error:', e); }
    })();

    res.json({ message: 'Booking cancelled' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/student/bookings/:id/reschedule', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { rows: existing } = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Booking not found' });
    const b = existing[0];
    if (b.student_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You are not authorized to reschedule this booking' });
    }

    await pool.query('UPDATE bookings SET scheduled_at=$1 WHERE id=$2', [req.body.scheduled_at, req.params.id]);
    res.json({ message: 'Booking rescheduled' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/student/bookings/:id/review', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const studentId = (req as any).user.id;
    const { teacher_id, stars, comment } = req.body;
    const { rows: existing } = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Booking not found' });
    const b = existing[0];
    if (b.student_id !== studentId) {
      return res.status(403).json({ error: 'Forbidden: You can only review your own lessons' });
    }

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

app.get('/api/topics', async (req: Request, res: Response): Promise<any> => {
  try {
    const { subjectId } = req.query;
    let query = 'SELECT id, name, subject_id FROM topics';
    const params: any[] = [];
    if (subjectId) {
      query += ' WHERE subject_id = $1';
      params.push(subjectId);
    }
    query += ' ORDER BY name';
    const { rows } = await pool.query(query, params);
    res.json({ topics: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/teachers', async (req: Request, res: Response): Promise<any> => {
  try {
    const { subjectId, examType, location, maxPrice } = req.query;
    let query = `
      SELECT t.user_id, t.video_url as headline, t.hourly_rate_cents, t.location as location, t.exam_types, t.verification_status,
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
    if (location) { query += ` AND t.location = $${paramIndex++}`; params.push(location); }
    if (maxPrice) { query += ` AND t.hourly_rate_cents <= $${paramIndex++}`; params.push(parseInt(maxPrice as string) * 100); }
    const { rows: teachers } = await pool.query(query, params);
    if (teachers.length > 0) {
      const ids = teachers.map(t => t.user_id);
      const [{ rows: ratings }, { rows: topicsRows }] = await Promise.all([
        pool.query('SELECT teacher_id, stars FROM ratings WHERE teacher_id = ANY($1::uuid[])', [ids]),
        pool.query(`
          SELECT tt.teacher_id, tt.is_specialty, tp.id as topic_id, tp.name as topic_name 
          FROM teacher_topics tt 
          JOIN topics tp ON tt.topic_id = tp.id 
          WHERE tt.teacher_id = ANY($1::uuid[])
          ORDER BY tt.is_specialty DESC, tp.name ASC
        `, [ids])
      ]);

      const agg = new Map<string, { sum: number; n: number }>();
      ratings.forEach(r => { 
        const a = agg.get(r.teacher_id) || { sum: 0, n: 0 }; 
        a.sum += Number(r.stars) || 0; 
        a.n++; 
        agg.set(r.teacher_id, a); 
      });

      const topicsMap = new Map<string, Array<{ id: string; name: string; is_specialty: boolean }>>();
      topicsRows.forEach(row => {
        const list = topicsMap.get(row.teacher_id) || [];
        list.push({ id: row.topic_id, name: row.topic_name, is_specialty: row.is_specialty });
        topicsMap.set(row.teacher_id, list);
      });

      teachers.forEach(t => {
        const a = agg.get(t.user_id);
        t.avg_stars = a && a.n > 0 ? Number((a.sum / a.n).toFixed(1)) : null;
        t.review_count = a?.n ?? 0;
        t.profiles = { full_name: t.full_name, avatar_url: t.avatar_url };
        t.subjects = { name: t.subject_name };
        t.topics = topicsMap.get(t.user_id) || [];
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
      pool.query(`SELECT r.id, r.stars, r.comment, r.created_at, b.scheduled_at, b.location, p.full_name as student_name, p.avatar_url as student_avatar 
                  FROM ratings r 
                  LEFT JOIN bookings b ON r.booking_id=b.id 
                  LEFT JOIN profiles p ON r.student_id=p.id 
                  WHERE r.teacher_id=$1 
                  ORDER BY r.created_at DESC`, [req.params.id]),
    ]);
    if (!tp.length) return res.status(404).json({ error: 'Teacher not found' });
    const t = tp[0];
    
    // Calculate automatic average rating from total accumulation of student reviews
    const totalStars = ratings.reduce((sum, r) => sum + (Number(r.stars) || 0), 0);
    const reviewCount = ratings.length;
    const avgStars = reviewCount > 0 ? Number((totalStars / reviewCount).toFixed(1)) : null;

    res.json({
      t: { 
        user_id: t.user_id, 
        headline: t.headline, 
        hourly_rate_cents: t.hourly_rate_cents, 
        years_experience: t.years_experience, 
        location: t.location, 
        verification_status: t.verification_status, 
        exam_types: t.exam_types, 
        avg_stars: avgStars,
        review_count: reviewCount,
        profiles: { full_name: t.full_name, bio: t.bio, avatar_url: t.avatar_url }, 
        subjects: { name: t.subject_name } 
      },
      topics: topics.map(tp => ({ id: tp.topic_id, name: tp.topic_name, is_specialty: tp.is_specialty })),
      availability,
      ratings: ratings.map(r => ({ 
        id: r.id,
        stars: r.stars, 
        comment: r.comment, 
        created_at: r.created_at,
        student_name: r.student_name || 'Verified Student',
        student_avatar: r.student_avatar || null,
        bookings: { scheduled_at: r.scheduled_at, location: r.location } 
      })),
      avg_stars: avgStars,
      review_count: reviewCount,
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

    // Send SMS Notification asynchronously
    (async () => {
      try {
        const { rows: profiles } = await pool.query(
          `SELECT p.id, p.full_name, p.phone FROM profiles p WHERE p.id IN ($1, $2)`,
          [studentId, teacher_id]
        );
        const student = profiles.find(p => p.id === studentId);
        const teacher = profiles.find(p => p.id === teacher_id);
        if (student && teacher) {
          await sendBookingCreatedSms({
            studentPhone: student.phone,
            teacherPhone: teacher.phone,
            studentName: student.full_name,
            teacherName: teacher.full_name,
            scheduledAt: scheduled_at,
            priceGhs: (price_cents / 100).toFixed(2),
          });
        }
      } catch (smsErr) {
        console.error('Error triggering booking SMS:', smsErr);
      }
    })();

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
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const { rows } = await pool.query('SELECT * FROM bookings WHERE id=$1', [booking_id]);
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];

    // Authorize: Ensure user is the student associated with the booking (or admin)
    if (booking.student_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You can only initialize payments for your own bookings' });
    }

    const envSecret = process.env.PAYSTACK_SECRET_KEY;
    const PAYSTACK_SECRET = (envSecret && envSecret !== 'sk_test_placeholder') 
      ? envSecret 
      : 'sk_test_05b7cf9ffe6c0d32950f71d345ec543d5cc6080a';

    if (!PAYSTACK_SECRET) {
      // Dev fallback — simulate initialization
      const devRef = `dev-ref-${Date.now()}`;
      await pool.query('UPDATE bookings SET paystack_reference=$1 WHERE id=$2', [devRef, booking_id]);
      return res.json({ authorization_url: null, reference: devRef, access_code: 'dev' });
    }

    const { price_cents } = booking;
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
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const { rows: bRows } = await pool.query('SELECT * FROM bookings WHERE id=$1', [booking_id]);
    if (!bRows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = bRows[0];

    // Authorize: Ensure user is the student associated with the booking (or admin)
    if (booking.student_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You can only verify payments for your own bookings' });
    }

    const envSecret = process.env.PAYSTACK_SECRET_KEY;
    const PAYSTACK_SECRET = (envSecret && envSecret !== 'sk_test_placeholder') 
      ? envSecret 
      : 'sk_test_05b7cf9ffe6c0d32950f71d345ec543d5cc6080a';

    let paymentAmountCents = booking.price_cents || 0;

    if (PAYSTACK_SECRET) {
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      });
      const data = await verifyRes.json() as any;
      if (!verifyRes.ok || data?.data?.status !== 'success') {
        return res.status(400).json({ error: 'Payment not successful', status: data?.data?.status });
      }
      paymentAmountCents = data.data.amount;
    }

    // 1. Update booking status and paystack reference
    await pool.query("UPDATE bookings SET status='confirmed', paystack_reference=$1 WHERE id=$2", [reference, booking_id]);

    // 2. Insert comprehensive transaction record
    await pool.query(`
      INSERT INTO transactions (
        booking_id,
        student_id,
        amount_cents,
        currency,
        paystack_reference,
        status,
        transaction_date
      ) VALUES ($1, $2, $3, 'GHS', $4, 'succeeded', CURRENT_TIMESTAMP)
    `, [booking_id, booking.student_id, paymentAmountCents, reference]);

    // 3. Send notifications and SMS for payment confirmation
    const { rows: bRows2 } = await pool.query(
      `SELECT b.*, sp.full_name as student_name, sp.phone as student_phone, tp.full_name as teacher_name, tp.phone as teacher_phone 
       FROM bookings b 
       JOIN profiles sp ON b.student_id = sp.id 
       JOIN profiles tp ON b.teacher_id = tp.id 
       WHERE b.id = $1`,
      [booking_id]
    );
    if (bRows2.length > 0) {
      const b = bRows2[0];
      const grossGhs = (b.price_cents / 100).toFixed(2);
      const netGhs = ((b.price_cents * 0.85) / 100).toFixed(2);
      await createNotification(
        b.teacher_id,
        'New Paid Booking Received!',
        `${b.student_name} paid GHS ${grossGhs} for a lesson on ${new Date(b.scheduled_at).toLocaleString()}. Net payout will be GHS ${netGhs} upon completion.`,
        'payment',
        '/dashboard/teacher'
      );
      await createNotification(
        b.student_id,
        'Payment Confirmed!',
        `Your payment of GHS ${grossGhs} for ${b.teacher_name} was successful. Lesson is confirmed!`,
        'payment',
        '/dashboard/student'
      );

      // Trigger Arkesel SMS notifications (Student, Tutor, and Admin)
      (async () => {
        try {
          // 1. Prompt Student & Tutor
          await sendPaymentConfirmedSms({
            studentPhone: b.student_phone,
            teacherPhone: b.teacher_phone,
            studentName: b.student_name,
            teacherName: b.teacher_name,
            scheduledAt: b.scheduled_at,
            amountGhs: grossGhs,
            netPayoutGhs: netGhs,
          });

          // 2. Prompt Admin
          const { rows: adminRows } = await pool.query(
            "SELECT phone FROM profiles WHERE role = 'admin' AND phone IS NOT NULL AND phone != '' LIMIT 1"
          );
          const adminPhone = process.env.ADMIN_PHONE || adminRows[0]?.phone;
          if (adminPhone) {
            await sendAdminPaymentAlertSms({
              adminPhone,
              studentName: b.student_name,
              teacherName: b.teacher_name,
              amountGhs: grossGhs,
              scheduledAt: b.scheduled_at,
            });
          }
        } catch (smsErr) {
          console.error('Error sending payment confirmation SMS:', smsErr);
        }
      })();
    }

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
      pool.query('SELECT status, price_cents, paid_out FROM bookings')
    ]);
    const users = parseInt(userCountRes[0].count, 10) || 0;
    const bookings = bookingsRes.length;
    
    const completedBookings = bookingsRes.filter(b => b.status === 'completed');
    const grossRevenueCents = completedBookings.reduce((sum, b) => sum + (b.price_cents || 0), 0);
    
    // 15% Platform / Admin Commission (Net Platform Earnings)
    const adminEarningsCents = Math.floor(grossRevenueCents * 0.15);
    
    // 85% Tutor Share
    const tutorEarningsCents = Math.floor(grossRevenueCents * 0.85);
    
    // Tutor pending vs settled payouts
    const pendingPayoutsCents = completedBookings
      .filter(b => !b.paid_out)
      .reduce((sum, b) => sum + Math.floor((b.price_cents || 0) * 0.85), 0);
      
    const completedPayoutsCents = completedBookings
      .filter(b => b.paid_out)
      .reduce((sum, b) => sum + Math.floor((b.price_cents || 0) * 0.85), 0);

    res.json({
      users,
      bookings,
      revenueCents: grossRevenueCents,
      grossRevenueCents,
      adminEarningsCents,
      tutorEarningsCents,
      pendingPayoutsCents,
      completedPayoutsCents,
      commissionRate: 15
    });
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
      const { rows } = await pool.query(`
        SELECT 
          t.id, 
          t.booking_id, 
          t.student_id, 
          t.amount_cents, 
          t.currency, 
          t.paystack_reference, 
          t.status, 
          COALESCE(t.transaction_date, t.created_at) as transaction_date, 
          t.created_at,
          sp.full_name as student_name,
          tp.full_name as teacher_name
        FROM transactions t
        LEFT JOIN bookings b ON t.booking_id = b.id
        LEFT JOIN profiles sp ON COALESCE(t.student_id, b.student_id) = sp.id
        LEFT JOIN profiles tp ON b.teacher_id = tp.id
        ORDER BY COALESCE(t.transaction_date, t.created_at) DESC LIMIT 50
      `);
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

app.get('/api/admin/payouts', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    // Find teachers who have completed, unpaid bookings. 85% cut.
    const { rows } = await pool.query(`
      SELECT b.teacher_id, p.full_name, p.phone, SUM(b.price_cents) as total_gross
      FROM bookings b
      JOIN profiles p ON b.teacher_id = p.id
      WHERE b.status = 'completed' AND b.paid_out = false
      GROUP BY b.teacher_id, p.full_name, p.phone
    `);
    const payouts = rows.map(r => ({
      teacher_id: r.teacher_id,
      full_name: r.full_name,
      phone: r.phone,
      amount_owed_cents: Math.floor(Number(r.total_gross) * 0.85)
    }));
    res.json({ payouts });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/payouts', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const { teacher_id, amount_cents } = req.body;
    await pool.query('BEGIN');
    
    // Mark their completed bookings as paid_out
    await pool.query(
      "UPDATE bookings SET paid_out = true WHERE teacher_id = $1 AND status = 'completed' AND paid_out = false",
      [teacher_id]
    );
    
    // Log the payout
    await pool.query(
      "INSERT INTO payouts (teacher_id, amount_cents) VALUES ($1, $2)",
      [teacher_id, amount_cents]
    );
    
    await pool.query('COMMIT');

    const payoutGhs = (amount_cents / 100).toFixed(2);
    await createNotification(
      teacher_id,
      'Mobile Money Payout Processed',
      `Admin has processed your payout of GHS ${payoutGhs} to your registered Mobile Money number.`,
      'payment',
      '/dashboard/teacher'
    );

    // Send SMS notice to teacher
    (async () => {
      try {
        const { rows: tRows } = await pool.query('SELECT full_name, phone FROM profiles WHERE id = $1', [teacher_id]);
        if (tRows.length && tRows[0].phone) {
          await sendPayoutRemittedSms({
            teacherPhone: tRows[0].phone,
            teacherName: tRows[0].full_name,
            amountGhs: payoutGhs,
          });
        }
      } catch (e) { console.error('Payout SMS error:', e); }
    })();

    res.json({ message: 'Payout recorded and bookings settled' });
  } catch (err: any) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
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

// ── DIRECT MESSAGES ──────────────────────────────────────────────────────────
app.get('/api/messages/contacts', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { rows } = await pool.query(`
      WITH user_contacts AS (
        SELECT 
          CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END as contact_id,
          content,
          created_at,
          ROW_NUMBER() OVER (
            PARTITION BY (CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END)
            ORDER BY created_at DESC
          ) as rn
        FROM messages
        WHERE sender_id = $1 OR receiver_id = $1
      )
      SELECT 
        p.id, 
        p.full_name, 
        p.avatar_url,
        p.role,
        uc.content as last_message,
        uc.created_at as last_message_at
      FROM user_contacts uc
      JOIN profiles p ON p.id = uc.contact_id
      WHERE uc.rn = 1
      ORDER BY uc.created_at DESC;
    `, [userId]);
    res.json({ contacts: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/messages/contact-info/:contactId', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { contactId } = req.params;
    const { rows } = await pool.query('SELECT id, full_name, avatar_url, role FROM profiles WHERE id = $1', [contactId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Contact not found' });
    res.json({ contact: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/messages/:contactId', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { contactId } = req.params;
    const { rows } = await pool.query(`
      SELECT m.id, m.sender_id, m.receiver_id, m.content, m.created_at,
             sp.full_name as sender_name, sp.avatar_url as sender_avatar
      FROM messages m
      JOIN profiles sp ON m.sender_id = sp.id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2)
         OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
    `, [userId, contactId]);
    res.json({ messages: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/messages', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const senderId = (req as any).user.id;
    const { receiver_id, content } = req.body;
    if (!receiver_id || !content?.trim()) {
      return res.status(400).json({ error: 'Receiver and non-empty content required' });
    }
    const { rows } = await pool.query(`
      INSERT INTO messages (sender_id, receiver_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, sender_id, receiver_id, content, created_at
    `, [senderId, receiver_id, content.trim()]);

    const { rows: sRows } = await pool.query('SELECT full_name FROM profiles WHERE id = $1', [senderId]);
    const senderName = sRows[0]?.full_name || 'Someone';
    await createNotification(
      receiver_id,
      `New Message from ${senderName}`,
      content.length > 70 ? content.slice(0, 70) + '...' : content,
      'message',
      `/messages?contactId=${senderId}`
    );

    res.json({ message: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── SUPPORT & DISPUTE TICKETS ────────────────────────────────────────────────
app.post('/api/support/tickets', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const reporterId = (req as any).user.id;
    const { booking_id, category, subject, description } = req.body;
    if (!category || !subject?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'Category, subject, and description are required' });
    }
    const { rows } = await pool.query(`
      INSERT INTO support_tickets (reporter_id, booking_id, category, subject, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [reporterId, booking_id || null, category, subject.trim(), description.trim()]);

    await createNotification(
      reporterId,
      'Support Ticket Submitted',
      `We received your report "${subject.trim()}". Admin is reviewing it.`,
      'support',
      '/dashboard'
    );

    res.json({ ticket: rows[0], message: 'Support ticket submitted successfully' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/support/my-tickets', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const reporterId = (req as any).user.id;
    const { rows } = await pool.query(`
      SELECT st.*, b.scheduled_at as booking_scheduled_at
      FROM support_tickets st
      LEFT JOIN bookings b ON st.booking_id = b.id
      WHERE st.reporter_id = $1
      ORDER BY st.created_at DESC
    `, [reporterId]);
    res.json({ tickets: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/tickets', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query(`
      SELECT st.*, 
             p.full_name as reporter_name, 
             p.role as reporter_role, 
             p.phone as reporter_phone, 
             u.email as reporter_email,
             b.scheduled_at as booking_scheduled_at,
             b.price_cents as booking_price_cents
      FROM support_tickets st
      JOIN profiles p ON st.reporter_id = p.id
      LEFT JOIN local_users u ON p.id = u.id
      LEFT JOIN bookings b ON st.booking_id = b.id
      ORDER BY 
        CASE WHEN st.status = 'open' THEN 1 WHEN st.status = 'in_progress' THEN 2 ELSE 3 END,
        st.created_at DESC
    `);
    res.json({ tickets: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/tickets/:ticketId/status', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const { ticketId } = req.params;
    const { status, resolution_notes } = req.body;
    const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
    const { rows } = await pool.query(`
      UPDATE support_tickets
      SET status = $1, resolution_notes = $2, resolved_at = $3
      WHERE id = $4
      RETURNING *
    `, [status, resolution_notes || null, resolvedAt, ticketId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    const ticket = rows[0];
    const noteMsg = resolution_notes ? `: "${resolution_notes}"` : '';
    await createNotification(
      ticket.reporter_id,
      `Support Ticket ${status.toUpperCase().replace('_', ' ')}`,
      `Admin updated your report "${ticket.subject}" to ${status.replace('_', ' ')}${noteMsg}`,
      'support',
      '/dashboard'
    );

    // Send SMS notice if ticket is resolved
    if (status === 'resolved') {
      (async () => {
        try {
          const { rows: uRows } = await pool.query('SELECT phone FROM profiles WHERE id = $1', [ticket.reporter_id]);
          if (uRows.length && uRows[0].phone) {
            await sendSupportResolvedSms({
              phone: uRows[0].phone,
              subject: ticket.subject,
              resolutionNotes: resolution_notes,
            });
          }
        } catch (e) { console.error('Support SMS error:', e); }
      })();
    }

    res.json({ ticket: rows[0], message: 'Ticket updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── SMS TESTING ENDPOINT ──────────────────────────────────────────────────────
app.post('/api/admin/sms/test', smsLimiter, requireAuth, requireAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'Phone and message are required' });
    const success = await sendSms(phone, message);
    if (success) {
      res.json({ success: true, message: `SMS sent to ${phone}` });
    } else {
      res.status(500).json({ success: false, error: 'Failed to deliver SMS. Check Arkesel API key and balance.' });
    }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── AUTOMATED 30-MIN & 5-MIN PRIOR LESSON REMINDERS WORKER ────────────────────
setInterval(async () => {
  try {
    const { rows: upcoming } = await pool.query(`
      SELECT b.id, b.scheduled_at, b.reminded_30m, b.reminded_5m,
             sp.full_name as student_name, sp.phone as student_phone,
             tp.full_name as teacher_name, tp.phone as teacher_phone
      FROM bookings b
      JOIN profiles sp ON b.student_id = sp.id
      JOIN profiles tp ON b.teacher_id = tp.id
      WHERE b.status = 'confirmed'
        AND b.scheduled_at > NOW()
        AND b.scheduled_at <= NOW() + INTERVAL '35 minutes'
        AND (b.reminded_30m IS FALSE OR b.reminded_5m IS FALSE)
    `);

    const nowMs = Date.now();
    for (const b of upcoming) {
      const schedMs = new Date(b.scheduled_at).getTime();
      const diffMinutes = (schedMs - nowMs) / (1000 * 60);

      // 30-minute reminder window (between 6 and 31 minutes before session)
      if (diffMinutes <= 31 && diffMinutes > 6 && !b.reminded_30m) {
        await pool.query('UPDATE bookings SET reminded_30m = true WHERE id = $1', [b.id]);
        await sendLessonPriorReminderSms({
          studentPhone: b.student_phone,
          teacherPhone: b.teacher_phone,
          studentName: b.student_name,
          teacherName: b.teacher_name,
          scheduledAt: b.scheduled_at,
          minutesBefore: 30,
        });
      }

      // 5-minute urgent reminder window (between 0 and 6 minutes before session)
      if (diffMinutes <= 6 && diffMinutes > 0 && !b.reminded_5m) {
        await pool.query('UPDATE bookings SET reminded_5m = true WHERE id = $1', [b.id]);
        await sendLessonPriorReminderSms({
          studentPhone: b.student_phone,
          teacherPhone: b.teacher_phone,
          studentName: b.student_name,
          teacherName: b.teacher_name,
          scheduledAt: b.scheduled_at,
          minutesBefore: 5,
        });
      }
    }
  } catch (err) {
    console.error('Error in lesson reminder background worker:', err);
  }
}, 60 * 1000);

// ── FRONTEND & SSR SERVING ──────────────────────────────────────────────────
const publicPath = path.resolve(__dirname, '../../.output/public');
const distPath = path.resolve(__dirname, '../../dist');

// Serve static assets (images, CSS, JS chunks)
app.use(express.static(publicPath));
app.use(express.static(distPath));

// Lazy-load Nitro SSR bundle with dynamic import (bypasses TypeScript CommonJS require rewrite)
const dynamicImport = new Function('specifier', 'return import(specifier)');
let nitroHandlerPromise: Promise<any> | null = null;
async function getNitroHandler() {
  if (nitroHandlerPromise) return nitroHandlerPromise;
  const nitroPath = path.resolve(__dirname, '../../.output/server/index.mjs');
  if (!fs.existsSync(nitroPath)) return null;
  
  nitroHandlerPromise = (async () => {
    try {
      const fileUrl = pathToFileURL(nitroPath).href;
      const m = await dynamicImport(fileUrl);
      console.log('✅ Nitro SSR module loaded successfully');
      return m.default || m;
    } catch (err) {
      console.error('Error loading Nitro SSR bundle:', err);
      nitroHandlerPromise = null;
      return null;
    }
  })();
  return nitroHandlerPromise;
}

// Catch-all route: delegate to Nitro SSR renderer
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }

  try {
    const handler = await getNitroHandler();
    if (handler && typeof handler.fetch === 'function') {
      const url = `${req.protocol}://${req.get('host') || 'localhost'}${req.originalUrl}`;
      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (val) {
          if (Array.isArray(val)) headers.set(key, val.join(', '));
          else headers.set(key, String(val));
        }
      }
      const webReq = new Request(url, {
        method: req.method,
        headers,
      });
      const dummyCtx = { waitUntil() {} };
      const response = await handler.fetch(webReq, {}, dummyCtx);
      if (response) {
        res.status(response.status);
        response.headers.forEach((v: string, k: string) => {
          res.setHeader(k, v);
        });
        const arrayBuf = await response.arrayBuffer();
        return res.send(Buffer.from(arrayBuf));
      }
    }
  } catch (ssrErr) {
    console.error('SSR render error for path', req.path, ssrErr);
  }

  // Fallback to static index.html if available
  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  const distIndexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(distIndexPath)) {
    return res.sendFile(distIndexPath);
  }

  res.status(404).send('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="2"><title>Loading QuickTutor</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>Starting QuickTutor...</h2><p>Loading application resources, please wait a moment...</p></body></html>');
});

// Start server (using httpServer for Socket.IO)
httpServer.listen(port, () => {
  console.log(`🚀 QuickTutor Backend running at http://localhost:${port}`);
  console.log(`📡 WebRTC signalling via Socket.IO active`);
  console.log(`⏰ Automated 30m & 5m Arkesel SMS reminder worker running`);
});
