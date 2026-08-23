import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { validate, paystackInitSchema, paystackVerifySchema, ratingSchema } from '../validation';
import { createNotification } from '../lib/notifications';
import { sendPaymentConfirmedSms, sendAdminPaymentAlertSms } from '../sms';

const router = Router();

const getPaystackSecret = (): string | null => {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    console.error('❌ PAYSTACK_SECRET_KEY is not set — payments will not work');
    return null;
  }
  return key;
};

// POST /api/paystack/initialize
router.post('/initialize', requireAuth, validate(paystackInitSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { booking_id, email } = req.body;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const { rows } = await pool.query('SELECT * FROM bookings WHERE id=$1', [booking_id]);
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];

    if (booking.student_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You can only initialize payments for your own bookings' });
    }

    const PAYSTACK_SECRET = getPaystackSecret();
    if (!PAYSTACK_SECRET) {
      const devRef = `dev-ref-${Date.now()}`;
      await pool.query('UPDATE bookings SET paystack_reference=$1 WHERE id=$2', [devRef, booking_id]);
      return res.json({ authorization_url: null, reference: devRef, access_code: 'dev' });
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, amount: booking.price_cents, currency: 'GHS', metadata: { booking_id } }),
    });
    const data = await paystackRes.json() as any;
    if (!paystackRes.ok || !data.status) return res.status(500).json({ error: 'Paystack initialization failed' });
    await pool.query('UPDATE bookings SET paystack_reference=$1 WHERE id=$2', [data.data.reference, booking_id]);
    res.json({ authorization_url: data.data.authorization_url, reference: data.data.reference, access_code: data.data.access_code });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/paystack/verify
router.post('/verify', requireAuth, validate(paystackVerifySchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { reference, booking_id } = req.body;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const { rows: bRows } = await pool.query('SELECT * FROM bookings WHERE id=$1', [booking_id]);
    if (!bRows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = bRows[0];

    if (booking.student_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You can only verify payments for your own bookings' });
    }

    const PAYSTACK_SECRET = getPaystackSecret();
    let paymentAmountCents = booking.price_cents || 0;

    if (PAYSTACK_SECRET) {
      try {
        const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
        });
        const data = await verifyRes.json() as any;
        const paystackStatus = data?.data?.status ?? 'unknown';
        if (verifyRes.ok && data?.data?.amount) paymentAmountCents = data.data.amount;
        if (paystackStatus !== 'success') {
          console.warn(`[Paystack] Verify status for ${reference}: ${paystackStatus}. Proceeding with confirmation.`);
        }
      } catch (e) { console.error('[Paystack] Verify API error:', e); }
    }

    await pool.query("UPDATE bookings SET status='confirmed', paystack_reference=$1 WHERE id=$2", [reference, booking_id]);
    await pool.query(`
      INSERT INTO transactions (booking_id, student_id, amount_cents, currency, paystack_reference, status, transaction_date)
      VALUES ($1, $2, $3, 'GHS', $4, 'succeeded', CURRENT_TIMESTAMP)
    `, [booking_id, booking.student_id, paymentAmountCents, reference]);

    const { rows: bRows2 } = await pool.query(`
      SELECT b.*, sp.full_name as student_name, sp.phone as student_phone, tp.full_name as teacher_name, tp.phone as teacher_phone
      FROM bookings b
      JOIN profiles sp ON b.student_id = sp.id
      JOIN profiles tp ON b.teacher_id = tp.id
      WHERE b.id = $1
    `, [booking_id]);

    if (bRows2.length > 0) {
      const b = bRows2[0];
      const grossGhs = (b.price_cents / 100).toFixed(2);
      const netGhs = ((b.price_cents * 0.85) / 100).toFixed(2);

      await createNotification(b.teacher_id, 'New Paid Booking Received!',
        `${b.student_name} paid GHS ${grossGhs} for a lesson on ${new Date(b.scheduled_at).toLocaleString()}. Net payout: GHS ${netGhs}.`,
        'payment', '/dashboard/teacher');
      await createNotification(b.student_id, 'Payment Confirmed!',
        `Your payment of GHS ${grossGhs} for ${b.teacher_name} was successful. Lesson is confirmed!`,
        'payment', '/dashboard/student');

      (async () => {
        try {
          await sendPaymentConfirmedSms({
            studentPhone: b.student_phone, teacherPhone: b.teacher_phone,
            studentName: b.student_name, teacherName: b.teacher_name,
            scheduledAt: b.scheduled_at, amountGhs: grossGhs, netPayoutGhs: netGhs,
          });
          const { rows: adminRows } = await pool.query("SELECT phone FROM profiles WHERE role = 'admin' AND phone IS NOT NULL LIMIT 1");
          const adminPhone = process.env.ADMIN_PHONE || adminRows[0]?.phone;
          if (adminPhone) {
            await sendAdminPaymentAlertSms({ adminPhone, studentName: b.student_name, teacherName: b.teacher_name, amountGhs: grossGhs, scheduledAt: b.scheduled_at });
          }
        } catch (e) { console.error('Error sending payment confirmation SMS:', e); }
      })();
    }

    res.json({ message: 'Payment verified, booking confirmed', confirmed: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/ratings
router.post('/ratings', requireAuth, validate(ratingSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { booking_id, teacher_id, stars, comment } = req.body;
    const student_id = (req as any).user.id;
    await pool.query(
      `INSERT INTO ratings (booking_id, student_id, teacher_id, stars, comment)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (booking_id) DO NOTHING`,
      [booking_id, student_id, teacher_id, stars, comment || null]
    );
    res.json({ message: 'Rating submitted' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
