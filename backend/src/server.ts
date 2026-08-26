import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

// ── Env validation ────────────────────────────────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL', 'PAYSTACK_SECRET_KEY'] as const;
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌ FATAL: Missing required environment variables: ${missing.join(', ')}`);
  console.error('   Copy backend/.env.example to backend/.env and fill in your values.');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET!;

// ── Shared infrastructure (imported after env check) ─────────────────────────
import { pool } from './db';
import { authLimiter } from './middleware/rateLimits';

// ── Route files ───────────────────────────────────────────────────────────────
import authRouter from './routes/auth';
import notificationsRouter from './routes/notifications';
import bookingsRouter from './routes/bookings';
import teachersRouter from './routes/teachers';
import paymentsRouter from './routes/payments';
import messagesRouter from './routes/messages';
import supportRouter from './routes/support';
import adminRouter from './routes/admin';

import {
  sendLessonPriorReminderSms,
} from './sms';

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 4000;

// ── Socket.IO for WebRTC signalling ──────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: { origin: true, credentials: true },
  path: '/socket.io',
});

const rooms = new Map<string, Set<string>>();

io.on('connection', async (socket) => {
  const { room: bookingId, token } = socket.handshake.query as Record<string, string>;
  if (!bookingId) { socket.disconnect(); return; }

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    socket.emit('error', { message: 'Invalid or expired session token' });
    socket.disconnect();
    return;
  }

  try {
    const { rows: bCheck } = await pool.query(
      'SELECT status, student_id, teacher_id, paystack_reference FROM bookings WHERE id = $1',
      [bookingId]
    );
    if (!bCheck.length) { socket.emit('error', { message: 'Booking not found' }); socket.disconnect(); return; }
    const booking = bCheck[0];
    if (booking.status === 'pending' || !booking.paystack_reference) { socket.emit('error', { message: 'Payment required before entering live classroom' }); socket.disconnect(); return; }
    if (booking.status === 'cancelled') { socket.emit('error', { message: 'This booking has been cancelled' }); socket.disconnect(); return; }
    if (decoded.id !== booking.student_id && decoded.id !== booking.teacher_id) { socket.emit('error', { message: 'You are not a participant in this booking' }); socket.disconnect(); return; }
  } catch (e) { socket.emit('error', { message: 'Failed to validate booking' }); socket.disconnect(); return; }

  if (!rooms.has(bookingId)) rooms.set(bookingId, new Set());
  const room = rooms.get(bookingId)!;
  room.add(socket.id);
  socket.join(bookingId);
  socket.to(bookingId).emit('peer-joined', { socketId: socket.id });

  socket.on('offer', (data) => socket.to(bookingId).emit('offer', { ...data, from: socket.id }));
  socket.on('answer', (data) => socket.to(bookingId).emit('answer', { ...data, from: socket.id }));
  socket.on('ice-candidate', (data) => socket.to(bookingId).emit('ice-candidate', { ...data, from: socket.id }));
  socket.on('disconnect', () => {
    room.delete(socket.id);
    if (room.size === 0) rooms.delete(bookingId);
    socket.to(bookingId).emit('peer-left', { socketId: socket.id });
  });
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'QuickTutor backend running!' });
});

// ── Database migrations ───────────────────────────────────────────────────────
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
        ('Core Mathematics'),('Integrated Science'),('English Language'),('Social Studies'),
        ('Physics'),('Chemistry'),('Biology'),('Elective Mathematics'),
        ('Information & Communication Tech (ICT)'),('Economics'),('Financial Accounting'),
        ('Cost Accounting'),('Business Management'),('Government'),('Geography'),
        ('History'),('French'),('Literature in English')
        ON CONFLICT (name) DO NOTHING;
      `);
      console.log('✅ Default Ghanaian subjects seeded automatically.');
    }

    await pool.query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;');
    await pool.query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;');
    await pool.query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;');
    await pool.query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false;');
    await pool.query(`
      ALTER TABLE teacher_profiles
      ADD COLUMN IF NOT EXISTS headline TEXT,
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS verification_notes TEXT,
      ADD COLUMN IF NOT EXISTS id_document_url TEXT,
      ADD COLUMN IF NOT EXISTS qualification_document_url TEXT,
      ADD COLUMN IF NOT EXISTS hourly_rate_cents INTEGER DEFAULT 4000,
      ADD COLUMN IF NOT EXISTS years_experience INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS location TEXT,
      ADD COLUMN IF NOT EXISTS exam_types JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS primary_subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_profiles (
        user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
        school_name TEXT,
        level TEXT,
        exam_type TEXT,
        location TEXT,
        guardian_phone TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
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
      CREATE TABLE IF NOT EXISTS teacher_availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        start_hour INTEGER NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
        end_hour INTEGER NOT NULL CHECK (end_hour BETWEEN 0 AND 24),
        UNIQUE(teacher_id, day_of_week, start_hour)
      );
      CREATE TABLE IF NOT EXISTS teacher_topics (
        teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
        is_specialty BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (teacher_id, topic_id)
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
    await pool.query(`
      UPDATE transactions t SET student_id = b.student_id FROM bookings b WHERE t.booking_id = b.id AND t.student_id IS NULL;
      UPDATE transactions SET transaction_date = created_at WHERE transaction_date IS NULL;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tutor_subjects (
        teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (teacher_id, subject_id)
      );
    `);
    await pool.query(`
      INSERT INTO tutor_subjects (teacher_id, subject_id)
      SELECT DISTINCT tt.teacher_id, t.subject_id FROM teacher_topics tt JOIN topics t ON tt.topic_id = t.id ON CONFLICT DO NOTHING;
      INSERT INTO tutor_subjects (teacher_id, subject_id)
      SELECT tp.user_id, tp.primary_subject_id FROM teacher_profiles tp WHERE tp.primary_subject_id IS NOT NULL ON CONFLICT DO NOTHING;
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
      ALTER TABLE support_tickets
        ADD COLUMN IF NOT EXISTS guest_name TEXT,
        ADD COLUMN IF NOT EXISTS guest_email TEXT,
        ADD COLUMN IF NOT EXISTS guest_phone TEXT;
      ALTER TABLE support_tickets ALTER COLUMN reporter_id DROP NOT NULL;
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

    // Email verification columns
    await pool.query(`
      ALTER TABLE local_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
      ALTER TABLE local_users ADD COLUMN IF NOT EXISTS verification_token TEXT;
    `);
    // Backfill existing users as verified (only new signups need to verify)
    await pool.query(`UPDATE local_users SET email_verified = true WHERE email_verified IS NULL OR email_verified = false;`);

    // Auto-seed / promote admin account
    const adminEmail = 'stevendarko97@gmail.com';
    const { rows: adminRows } = await pool.query('SELECT id FROM local_users WHERE email = $1', [adminEmail]);
    if (adminRows.length === 0) {
      const password_hash = await bcrypt.hash('adminpassword', 10);
      const { rows: [{ id: adminId }] } = await pool.query(
        'INSERT INTO local_users (email, password_hash, email_verified) VALUES ($1, $2, true) RETURNING id',
        [adminEmail, password_hash]
      );
      await pool.query("INSERT INTO profiles (id, full_name, role) VALUES ($1, 'Steven Darko (Admin)', 'admin') ON CONFLICT (id) DO UPDATE SET role = 'admin'", [adminId]);
      console.log(`✅ Admin account created: ${adminEmail}`);
    } else {
      const adminId = adminRows[0].id;
      await pool.query('UPDATE local_users SET email_verified = true WHERE id = $1', [adminId]);
      await pool.query("INSERT INTO profiles (id, full_name, role) VALUES ($1, 'Steven Darko (Admin)', 'admin') ON CONFLICT (id) DO UPDATE SET role = 'admin'", [adminId]);
      console.log(`✅ Admin role ensured for: ${adminEmail}`);
    }
  } catch (e) {
    console.error('Migration error:', e);
  }
})();

// ── Mount routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api', bookingsRouter);       // /api/student/*, /api/teacher/*, /api/bookings/*
app.use('/api', teachersRouter);       // /api/subjects, /api/topics, /api/teachers, /api/teacher/:id/*
app.use('/api/paystack', paymentsRouter);
app.use('/api', paymentsRouter);       // /api/ratings
app.use('/api/messages', messagesRouter);
app.use('/api/support', supportRouter);
app.use('/api/admin', adminRouter);


// ── Automated 30-min & 5-min lesson reminder worker ──────────────────────────
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
      const diffMinutes = (new Date(b.scheduled_at).getTime() - nowMs) / (1000 * 60);
      if (diffMinutes <= 31 && diffMinutes > 6 && !b.reminded_30m) {
        await pool.query('UPDATE bookings SET reminded_30m = true WHERE id = $1', [b.id]);
        await sendLessonPriorReminderSms({ studentPhone: b.student_phone, teacherPhone: b.teacher_phone, studentName: b.student_name, teacherName: b.teacher_name, scheduledAt: b.scheduled_at, minutesBefore: 30 });
      }
      if (diffMinutes <= 6 && diffMinutes > 0 && !b.reminded_5m) {
        await pool.query('UPDATE bookings SET reminded_5m = true WHERE id = $1', [b.id]);
        await sendLessonPriorReminderSms({ studentPhone: b.student_phone, teacherPhone: b.teacher_phone, studentName: b.student_name, teacherName: b.teacher_name, scheduledAt: b.scheduled_at, minutesBefore: 5 });
      }
    }
  } catch (err) {
    console.error('Error in lesson reminder worker:', err);
  }
}, 60 * 1000);

// ── Frontend & SSR serving ────────────────────────────────────────────────────
const publicPath = path.resolve(__dirname, '../../.output/public');
const distPath = path.resolve(__dirname, '../../dist');

app.use(express.static(publicPath));
app.use(express.static(distPath));

const dynamicImport = new Function('specifier', 'return import(specifier)');
let nitroHandlerPromise: Promise<any> | null = null;
async function getNitroHandler() {
  if (nitroHandlerPromise) return nitroHandlerPromise;
  const nitroPath = path.resolve(__dirname, '../../.output/server/index.mjs');
  if (!fs.existsSync(nitroPath)) return null;
  nitroHandlerPromise = (async () => {
    try {
      const m = await dynamicImport(pathToFileURL(nitroPath).href);
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

app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  try {
    const handler = await getNitroHandler();
    if (handler && typeof handler.fetch === 'function') {
      const url = `${req.protocol}://${req.get('host') || 'localhost'}${req.originalUrl}`;
      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (val) { if (Array.isArray(val)) headers.set(key, val.join(', ')); else headers.set(key, String(val)); }
      }
      const response = await handler.fetch(new Request(url, { method: req.method, headers }), {}, { waitUntil() {} });
      if (response) {
        res.status(response.status);
        response.headers.forEach((v: string, k: string) => res.setHeader(k, v));
        return res.send(Buffer.from(await response.arrayBuffer()));
      }
    }
  } catch (ssrErr) { console.error('SSR render error for path', req.path, ssrErr); }

  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  const distIndex = path.join(distPath, 'index.html');
  if (fs.existsSync(distIndex)) return res.sendFile(distIndex);

  res.status(404).send('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="2"><title>Loading QuickTutor</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>Starting QuickTutor...</h2><p>Loading application resources, please wait a moment...</p></body></html>');
});

// ── Start server ──────────────────────────────────────────────────────────────
httpServer.listen(port, () => {
  console.log(`🚀 QuickTutor Backend running at http://localhost:${port}`);
  console.log(`📡 WebRTC signalling via Socket.IO active`);
  console.log(`⏰ Automated 30m & 5m SMS reminder worker running`);
});
