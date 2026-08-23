import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { validate, supportTicketSchema } from '../validation';
import { createNotification } from '../lib/notifications';

const router = Router();

// POST /api/support/tickets
router.post('/tickets', requireAuth, validate(supportTicketSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const reporterId = (req as any).user.id;
    const { booking_id, category, subject, description } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO support_tickets (reporter_id, booking_id, category, subject, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [reporterId, booking_id || null, category, subject, description]);

    await createNotification(
      reporterId,
      'Support Ticket Submitted',
      `We received your report "${subject}". Admin is reviewing it.`,
      'support',
      '/dashboard'
    );

    res.json({ ticket: rows[0], message: 'Support ticket submitted successfully' });
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
