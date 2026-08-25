import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { createNotification } from '../lib/notifications';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'quicktutor_jwt_secret_dev';

// POST /api/support/tickets (Supports logged-in users, guests, and suspended users)
router.post('/tickets', async (req: Request, res: Response): Promise<any> => {
  try {
    let reporterId: string | null = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded: any = jwt.verify(token, JWT_SECRET);
        reporterId = decoded.id;
      }
    } catch {}

    const { booking_id, category, subject, description, name, email, phone } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ error: 'Subject and description are required' });
    }

    if (!reporterId && (!email || !phone)) {
      return res.status(400).json({ error: 'Please provide your email and Ghana phone number' });
    }

    const { rows } = await pool.query(`
      INSERT INTO support_tickets (reporter_id, booking_id, category, subject, description, guest_name, guest_email, guest_phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [reporterId, booking_id || null, category || 'general', subject, description, name || null, email || null, phone || null]);

    if (reporterId) {
      await createNotification(
        reporterId,
        'Support Ticket Submitted',
        `We received your report "${subject}". Admin is reviewing it.`,
        'support',
        '/dashboard'
      );
    }

    res.json({ ticket: rows[0], message: 'Support ticket submitted successfully. Admin has been notified.' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/support/my-tickets
router.get('/my-tickets', requireAuth, async (req: Request, res: Response): Promise<any> => {
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

export default router;
