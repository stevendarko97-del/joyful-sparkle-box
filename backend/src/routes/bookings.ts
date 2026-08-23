import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import {
  validate,
  createBookingSchema,
  rescheduleBookingSchema,
} from '../validation';
import { createNotification } from '../lib/notifications';
import {
  sendBookingCreatedSms,
  sendBookingCancelledSms,
} from '../sms';

const router = Router();

// ── Student Dashboard ─────────────────────────────────────────────────────────
router.get('/student/dashboard', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { rows: bookings } = await pool.query(
      'SELECT b.id, b.scheduled_at, b.status, b.price_cents, b.room_id, b.teacher_id, p.full_name as teacher_name FROM bookings b JOIN profiles p ON b.teacher_id = p.id WHERE b.student_id = $1 ORDER BY b.scheduled_at DESC',
      [userId]
    );
    const bookingIds = bookings.map((b) => b.id);
    let ratings: any[] = [];
    if (bookingIds.length > 0) {
      const { rows } = await pool.query('SELECT booking_id FROM ratings WHERE booking_id = ANY($1::uuid[])', [bookingIds]);
      ratings = rows;
    }
    res.json({
      bookings: bookings.map((b) => ({ ...b, profiles: { full_name: b.teacher_name } })),
      ratedIds: ratings.map((r) => r.booking_id),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Teacher Dashboard ─────────────────────────────────────────────────────────
router.get('/teacher/dashboard', requireAuth, async (req: Request, res: Response): Promise<any> => {
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
      pool.query('SELECT b.id, b.scheduled_at, b.status, b.price_cents, b.room_id, b.paystack_reference, p.full_name as student_name FROM bookings b JOIN profiles p ON b.student_id = p.id WHERE b.teacher_id = $1 ORDER BY b.scheduled_at DESC', [userId]),
      pool.query('SELECT id, day_of_week, start_hour, end_hour FROM teacher_availability WHERE teacher_id = $1 ORDER BY day_of_week', [userId]),
      pool.query('SELECT id, title, message, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId]),
      pool.query('SELECT r.id, r.stars, r.comment, r.created_at, p.full_name as student_name FROM ratings r JOIN profiles p ON r.student_id = p.id WHERE r.teacher_id = $1 ORDER BY r.created_at DESC LIMIT 5', [userId]),
    ]);
    res.json({ subjects, topics, teacherProfile: teacherProfile[0], profile: profile[0], teacherTopics, bookings, availability, notifications, ratings });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Create Booking ────────────────────────────────────────────────────────────
router.post('/student/bookings', requireAuth, validate(createBookingSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const studentId = (req as any).user.id;
    const { teacher_id, topic_id, scheduled_at, duration_minutes, price_cents, location } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO bookings (student_id, teacher_id, topic_id, scheduled_at, duration_minutes, price_cents, status, location)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING id`,
      [studentId, teacher_id, topic_id || null, scheduled_at, duration_minutes, price_cents, location]
    );

    (async () => {
      try {
        const { rows: profiles } = await pool.query(`SELECT p.id, p.full_name, p.phone FROM profiles p WHERE p.id IN ($1, $2)`, [studentId, teacher_id]);
        const student = profiles.find((p) => p.id === studentId);
        const teacher = profiles.find((p) => p.id === teacher_id);
        if (student && teacher) {
          await sendBookingCreatedSms({ studentPhone: student.phone, teacherPhone: teacher.phone, studentName: student.full_name, teacherName: teacher.full_name, scheduledAt: scheduled_at, priceGhs: (price_cents / 100).toFixed(2) });
        }
      } catch (e) { console.error('Error triggering booking SMS:', e); }
    })();

    res.json({ message: 'Booking created', booking_id: rows[0].id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Get Booking ───────────────────────────────────────────────────────────────
router.get('/bookings/:id', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { rows } = await pool.query(
      'SELECT b.*, p.full_name as student_name, pt.full_name as teacher_name FROM bookings b JOIN profiles p ON b.student_id=p.id JOIN profiles pt ON b.teacher_id=pt.id WHERE b.id=$1',
      [req.params.id]
    );
    const b = rows[0];
    if (!b) return res.status(404).json({ error: 'Not found' });
    if (b.student_id !== userId && b.teacher_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    res.json({ booking: b, other_name: b.student_id === userId ? b.teacher_name : b.student_name });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Cancel Booking ────────────────────────────────────────────────────────────
router.put('/student/bookings/:id/cancel', requireAuth, async (req: Request, res: Response): Promise<any> => {
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
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [req.params.id]);

    (async () => {
      try {
        const isByStudent = b.student_id === userId;
        const targetPhone = isByStudent ? b.teacher_phone : b.student_phone;
        const targetName = isByStudent ? b.teacher_name : b.student_name;
        const cancelledByName = isByStudent ? b.student_name : b.teacher_name;
        if (targetPhone) {
          await sendBookingCancelledSms({ phone: targetPhone, name: targetName, scheduledAt: b.scheduled_at, cancelledBy: cancelledByName });
        }
      } catch (e) { console.error('SMS cancel notice error:', e); }
    })();

    res.json({ message: 'Booking cancelled' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Reschedule Booking ────────────────────────────────────────────────────────
router.put('/student/bookings/:id/reschedule', requireAuth, validate(rescheduleBookingSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { rows: existing } = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Booking not found' });
    const b = existing[0];
    if (b.student_id !== userId && userRole !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    await pool.query('UPDATE bookings SET scheduled_at=$1 WHERE id=$2', [req.body.scheduled_at, req.params.id]);
    res.json({ message: 'Booking rescheduled' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Review Booking ────────────────────────────────────────────────────────────
router.post('/student/bookings/:id/review', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const studentId = (req as any).user.id;
    const { teacher_id, stars, comment } = req.body;
    const { rows: existing } = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Booking not found' });
    if (existing[0].student_id !== studentId) return res.status(403).json({ error: 'Forbidden: You can only review your own lessons' });
    await pool.query('INSERT INTO ratings (booking_id, teacher_id, student_id, stars, comment) VALUES ($1,$2,$3,$4,$5)', [req.params.id, teacher_id, studentId, stars, comment]);
    res.json({ message: 'Review submitted' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Teacher: Update Booking Status ────────────────────────────────────────────
router.patch('/teacher/bookings/:id/status', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { status } = req.body;
    if (!['confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const { rows } = await pool.query(
      `SELECT b.*, p.full_name as teacher_name, p.phone as teacher_phone, sp.full_name as student_name, sp.phone as student_phone
       FROM bookings b JOIN profiles p ON b.teacher_id=p.id JOIN profiles sp ON b.student_id=sp.id WHERE b.id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    const b = rows[0];
    if (b.teacher_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    await pool.query('UPDATE bookings SET status=$1 WHERE id=$2', [status, req.params.id]);

    if (status === 'confirmed') {
      await createNotification(b.student_id, 'Lesson Booking Confirmed',
        `Your tutor ${b.teacher_name} confirmed your lesson for ${new Date(b.scheduled_at).toLocaleString()}.`,
        'booking', '/dashboard/student');
    } else if (status === 'cancelled') {
      await createNotification(b.student_id, 'Lesson Cancelled',
        `Your booking with ${b.teacher_name} was cancelled.`, 'booking', '/dashboard/student');
      (async () => {
        try {
          if (b.student_phone) {
            await sendBookingCancelledSms({ phone: b.student_phone, name: b.student_name, scheduledAt: b.scheduled_at, cancelledBy: b.teacher_name });
          }
        } catch (e) { console.error('SMS cancel error:', e); }
      })();
    }

    res.json({ message: 'Status updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Favorites ─────────────────────────────────────────────────────────────────
router.get('/student/favorites', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { rows } = await pool.query('SELECT teacher_id FROM favorites WHERE student_id=$1', [userId]);
    res.json({ favorites: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/student/favorites', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    await pool.query('INSERT INTO favorites (student_id, teacher_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, req.body.teacher_id]);
    res.json({ message: 'Added to favorites' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/student/favorites', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    await pool.query('DELETE FROM favorites WHERE student_id=$1 AND teacher_id=$2', [userId, req.body.teacher_id]);
    res.json({ message: 'Removed from favorites' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
