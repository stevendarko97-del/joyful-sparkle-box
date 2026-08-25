import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { smsLimiter } from '../middleware/rateLimits';
import { validate, payoutSchema, verificationActionSchema, ticketStatusSchema, smsTestSchema, suspendUserSchema } from '../validation';
import { createNotification } from '../lib/notifications';
import { sendSms, sendPayoutRemittedSms, sendSupportResolvedSms } from '../sms';

const router = Router();

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', async (_req: Request, res: Response): Promise<any> => {
  try {
    const [{ rows: userCountRes }, { rows: bookingsRes }] = await Promise.all([
      pool.query('SELECT count(*) as count FROM profiles'),
      pool.query('SELECT status, price_cents, paid_out FROM bookings'),
    ]);
    const users = parseInt(userCountRes[0].count, 10) || 0;
    const completed = bookingsRes.filter((b) => b.status === 'completed');
    const grossRevenueCents = completed.reduce((s, b) => s + (b.price_cents || 0), 0);
    const adminEarningsCents = Math.floor(grossRevenueCents * 0.15);
    const tutorEarningsCents = Math.floor(grossRevenueCents * 0.85);
    const pendingPayoutsCents = completed.filter((b) => !b.paid_out).reduce((s, b) => s + Math.floor((b.price_cents || 0) * 0.85), 0);
    const completedPayoutsCents = completed.filter((b) => b.paid_out).reduce((s, b) => s + Math.floor((b.price_cents || 0) * 0.85), 0);
    res.json({ users, bookings: bookingsRes.length, revenueCents: grossRevenueCents, grossRevenueCents, adminEarningsCents, tutorEarningsCents, pendingPayoutsCents, completedPayoutsCents, commissionRate: 15 });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Analytics ──────────────────────────────────────────────────────────────────
router.get('/analytics', async (_req: Request, res: Response): Promise<any> => {
  try {
    const revenueRes = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
        DATE_TRUNC('month', created_at) as month_start,
        SUM(price_cents) as gross_cents,
        COUNT(*) as booking_count
      FROM bookings
      WHERE status = 'completed'
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month_start ASC
    `);

    const usersRes = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
        DATE_TRUNC('month', created_at) as month_start,
        COUNT(*) as user_count
      FROM profiles
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month_start ASC
    `);

    const subjectsRes = await pool.query(`
      SELECT s.name, COUNT(b.id) as booking_count
      FROM subjects s
      JOIN bookings b ON b.topic_id IN (
        SELECT id FROM topics WHERE subject_id = s.id
      )
      GROUP BY s.id, s.name
      ORDER BY booking_count DESC
      LIMIT 5
    `).catch(() => ({ rows: [] as any[] }));

    const statusRes = await pool.query(`
      SELECT status, COUNT(*) as count FROM bookings GROUP BY status
    `);

    res.json({
      monthly: revenueRes.rows.map(r => ({
        month: r.month,
        revenueCents: parseInt(r.gross_cents, 10) || 0,
        bookings: parseInt(r.booking_count, 10) || 0,
      })),
      userGrowth: usersRes.rows.map(r => ({
        month: r.month,
        users: parseInt(r.user_count, 10) || 0,
      })),
      topSubjects: subjectsRes.rows.map(r => ({
        name: r.name,
        count: parseInt(r.booking_count, 10) || 0,
      })),
      bookingsByStatus: statusRes.rows.map(r => ({
        status: r.status,
        count: parseInt(r.count, 10) || 0,
      })),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Users / Bookings / Transactions ──────────────────────────────────────────
router.get('/users', async (_req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.full_name, p.role, p.phone,
             COALESCE(tp.location, sp.location) as location,
             COALESCE(p.suspended, false) as suspended,
             p.created_at, u.email,
             tp.verification_status, tp.hourly_rate_cents
      FROM profiles p
      LEFT JOIN local_users u ON p.id = u.id
      LEFT JOIN teacher_profiles tp ON p.id = tp.user_id
      LEFT JOIN student_profiles sp ON p.id = sp.user_id
      ORDER BY p.created_at DESC
      LIMIT 200
    `);
    res.json({ users: rows });
  } catch (err: any) {
    try {
      const { rows } = await pool.query(`
        SELECT p.id, p.full_name, p.role, p.phone, p.created_at, u.email
        FROM profiles p
        LEFT JOIN local_users u ON p.id = u.id
        ORDER BY p.created_at DESC
        LIMIT 200
      `);
      res.json({ users: rows.map(r => ({ ...r, suspended: false, verification_status: null, location: null })) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
});

router.get('/bookings', async (_req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query('SELECT id, scheduled_at, status, price_cents FROM bookings ORDER BY created_at DESC LIMIT 50');
    res.json({ bookings: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/transactions', async (_req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query(`
      SELECT t.id, t.booking_id, t.student_id, t.amount_cents, t.currency, t.paystack_reference, t.status,
             COALESCE(t.transaction_date, t.created_at) as transaction_date, t.created_at,
             sp.full_name as student_name, tp.full_name as teacher_name
      FROM transactions t
      LEFT JOIN bookings b ON t.booking_id = b.id
      LEFT JOIN profiles sp ON COALESCE(t.student_id, b.student_id) = sp.id
      LEFT JOIN profiles tp ON b.teacher_id = tp.id
      ORDER BY COALESCE(t.transaction_date, t.created_at) DESC LIMIT 50
    `);
    res.json({ transactions: rows });
  } catch { res.json({ transactions: [] }); }
});

// ── Suspend / Unsuspend Users ─────────────────────────────────────────────────
router.post('/users/:userId/suspend', validate(suspendUserSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId as string;
    const { reason } = req.body;
    const { rows } = await pool.query(
      `UPDATE profiles SET suspended = true WHERE id = $1 RETURNING full_name, role`,
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await createNotification(
      userId,
      'Account Suspended',
      `Your account has been suspended${reason ? `: ${reason}` : ' due to a policy violation'}. Please contact support for assistance.`,
      'support',
      '/support'
    );
    res.json({ message: `${rows[0].full_name} (${rows[0].role}) has been suspended` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/users/:userId/unsuspend', async (_req: Request, res: Response): Promise<any> => {
  try {
    const userId = _req.params.userId as string;
    const { rows } = await pool.query(
      `UPDATE profiles SET suspended = false WHERE id = $1 RETURNING full_name, role`,
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await createNotification(
      userId,
      'Account Reinstated',
      'Your account suspension has been lifted. You can now access all QuickTutor features again.',
      'support',
      '/dashboard'
    );
    res.json({ message: `${rows[0].full_name} (${rows[0].role}) has been reinstated` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Verifications ─────────────────────────────────────────────────────────────
router.get('/verifications', async (_req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query(
      `SELECT t.user_id, t.id_document_url, t.qualification_document_url, t.verification_status, p.full_name
       FROM teacher_profiles t JOIN profiles p ON t.user_id = p.id
       WHERE t.verification_status IN ('pending', 'unverified')
       ORDER BY t.created_at DESC`
    );
    res.json({ pending: rows.map((r) => ({ user_id: r.user_id, id_document_url: r.id_document_url, qualification_document_url: r.qualification_document_url, verification_status: r.verification_status, profiles: { full_name: r.full_name } })) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/verifications/:userId', validate(verificationActionSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId as string;
    const { approve, notes } = req.body;
    const status = approve ? 'verified' : 'rejected';
    const verifiedAt = approve ? new Date().toISOString() : null;

    const resUpdate = await pool.query(
      `UPDATE teacher_profiles
       SET verification_status = $1, verified_at = $2, verification_notes = $3, is_active = true
       WHERE user_id = $4 RETURNING user_id`,
      [status, verifiedAt, notes || null, userId]
    );

    if (resUpdate.rowCount === 0) {
      await pool.query(
        `INSERT INTO teacher_profiles (user_id, verification_status, verified_at, verification_notes, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (user_id) DO UPDATE SET
           verification_status = EXCLUDED.verification_status,
           verified_at = EXCLUDED.verified_at,
           verification_notes = EXCLUDED.verification_notes,
           is_active = true`,
        [userId, status, verifiedAt, notes || null]
      );
    }

    if (approve) {
      await createNotification(
        userId,
        '✅ Profile & Certificate Verified — You\'re Now Live!',
        'Congratulations! Your teaching profile has been approved by our admin team. Your profile is now visible to students on Find a Tutor and you can start receiving bookings.',
        'general',
        '/dashboard/teacher'
      );
    } else {
      await createNotification(
        userId,
        '❌ Certificate Verification Notice',
        `Your verification request was rejected${notes ? `: ${notes}` : ''}. Please upload a valid certificate or license in your Profile tab and submit for re-review.`,
        'support',
        '/dashboard/teacher'
      );
    }
    res.json({ message: `Verification status updated to ${status}` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Payouts ───────────────────────────────────────────────────────────────────
router.get('/payouts', async (_req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query(`
      SELECT b.teacher_id, p.full_name, p.phone, SUM(b.price_cents) as total_gross
      FROM bookings b JOIN profiles p ON b.teacher_id = p.id
      WHERE b.status = 'completed' AND b.paid_out = false
      GROUP BY b.teacher_id, p.full_name, p.phone
    `);
    res.json({ payouts: rows.map((r) => ({ teacher_id: r.teacher_id, full_name: r.full_name, phone: r.phone, amount_owed_cents: Math.floor(Number(r.total_gross) * 0.85) })) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/payouts', validate(payoutSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { teacher_id, amount_cents } = req.body;
    await pool.query('BEGIN');
    await pool.query("UPDATE bookings SET paid_out = true WHERE teacher_id = $1 AND status = 'completed' AND paid_out = false", [teacher_id]);
    await pool.query('INSERT INTO payouts (teacher_id, amount_cents) VALUES ($1, $2)', [teacher_id, amount_cents]);
    await pool.query('COMMIT');

    const payoutGhs = (amount_cents / 100).toFixed(2);
    await createNotification(teacher_id, 'Mobile Money Payout Processed',
      `Admin has processed your payout of GHS ${payoutGhs} to your registered Mobile Money number.`, 'payment', '/dashboard/teacher');

    (async () => {
      try {
        const { rows: tRows } = await pool.query('SELECT full_name, phone FROM profiles WHERE id = $1', [teacher_id]);
        if (tRows.length && tRows[0].phone) {
          await sendPayoutRemittedSms({ teacherPhone: tRows[0].phone, teacherName: tRows[0].full_name, amountGhs: payoutGhs });
        }
      } catch (e) { console.error('Payout SMS error:', e); }
    })();

    res.json({ message: 'Payout recorded and bookings settled' });
  } catch (err: any) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// ── Support Tickets ───────────────────────────────────────────────────────────
router.get('/tickets', async (_req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query(`
      SELECT st.*,
             COALESCE(p.full_name, st.guest_name, 'Guest User') as reporter_name,
             COALESCE(p.role, CASE WHEN st.category = 'account_appeal' THEN 'suspended_user' ELSE 'guest' END) as reporter_role,
             COALESCE(p.phone, st.guest_phone) as reporter_phone,
             COALESCE(u.email, st.guest_email) as reporter_email,
             b.scheduled_at as booking_scheduled_at, b.price_cents as booking_price_cents
      FROM support_tickets st
      LEFT JOIN profiles p ON st.reporter_id = p.id
      LEFT JOIN local_users u ON p.id = u.id
      LEFT JOIN bookings b ON st.booking_id = b.id
      ORDER BY CASE WHEN st.status = 'open' THEN 1 WHEN st.status = 'in_progress' THEN 2 ELSE 3 END, st.created_at DESC
    `);
    res.json({ tickets: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/tickets/:ticketId/status', validate(ticketStatusSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { ticketId } = req.params;
    const { status, resolution_notes } = req.body;
    const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
    const { rows } = await pool.query(
      `UPDATE support_tickets SET status = $1, resolution_notes = $2, resolved_at = $3 WHERE id = $4 RETURNING *`,
      [status, resolution_notes || null, resolvedAt, ticketId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    const ticket = rows[0];
    const noteMsg = resolution_notes ? `: "${resolution_notes}"` : '';

    if (ticket.reporter_id) {
      await createNotification(ticket.reporter_id,
        `Support Ticket ${status.toUpperCase().replace('_', ' ')}`,
        `Admin updated your report "${ticket.subject}" to ${status.replace('_', ' ')}${noteMsg}`,
        'support', '/dashboard');
    }

    if (status === 'resolved') {
      (async () => {
        try {
          let phoneToSms = ticket.guest_phone;
          if (ticket.reporter_id) {
            const { rows: uRows } = await pool.query('SELECT phone FROM profiles WHERE id = $1', [ticket.reporter_id]);
            if (uRows.length && uRows[0].phone) phoneToSms = uRows[0].phone;
          }
          if (phoneToSms) {
            await sendSupportResolvedSms({ phone: phoneToSms, subject: ticket.subject, resolutionNotes: resolution_notes });
          }
        } catch (e) { console.error('Support SMS error:', e); }
      })();
    }

    res.json({ ticket: rows[0], message: 'Ticket updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── SMS Test ──────────────────────────────────────────────────────────────────
router.post('/sms/test', smsLimiter, validate(smsTestSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { phone, message } = req.body;
    const success = await sendSms(phone, message);
    if (success) return res.json({ success: true, message: `SMS sent to ${phone}` });
    return res.status(500).json({ success: false, error: 'Failed to deliver SMS. Check Arkesel API key and balance.' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
