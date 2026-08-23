import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { createNotification } from '../lib/notifications';

const router = Router();

// GET /api/notifications
router.get('/', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    let { rows } = await pool.query(
      'SELECT id, title, message, type, link, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [userId]
    );

    if (rows.length === 0) {
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
            await createNotification(userId, 'Lesson Completed · Payout Queued',
              `Lesson with ${b.other_name} was completed. Net payout: GHS ${((b.price_cents * 0.85) / 100).toFixed(2)} (after 15% deduction).`,
              'payment', '/dashboard/teacher');
          } else {
            await createNotification(userId, 'Lesson Completed',
              `Your session with ${b.other_name} was completed!`, 'booking', '/dashboard/student');
          }
        } else if (b.status === 'confirmed') {
          await createNotification(userId, 'Confirmed Session',
            `You have a confirmed lesson with ${b.other_name} on ${new Date(b.scheduled_at).toLocaleString()}.`,
            'booking', b.student_id === userId ? '/dashboard/student' : '/dashboard/teacher');
        }
      }

      const { rows: userTickets } = await pool.query(
        'SELECT * FROM support_tickets WHERE reporter_id = $1 ORDER BY created_at DESC LIMIT 3', [userId]
      );
      for (const t of userTickets) {
        if (t.status === 'resolved') {
          await createNotification(userId, 'Support Ticket Resolved',
            `Your report "${t.subject}" was resolved by Admin${t.resolution_notes ? `: ${t.resolution_notes}` : ''}.`,
            'support', '/dashboard');
        } else {
          await createNotification(userId, 'Support Ticket Under Review',
            `Your report "${t.subject}" is being reviewed by Admin.`, 'support', '/dashboard');
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

// PUT /api/notifications/read-all
router.put('/read-all', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [userId]);
    res.json({ message: 'All notifications marked as read' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
    res.json({ message: 'Notification marked as read' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
