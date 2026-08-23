import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { validate, sendMessageSchema } from '../validation';
import { createNotification } from '../lib/notifications';

const router = Router();

// GET /api/messages/contacts
router.get('/contacts', requireAuth, async (req: Request, res: Response): Promise<any> => {
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

// GET /api/messages/contact-info/:contactId
router.get('/contact-info/:contactId', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { contactId } = req.params;
    const { rows } = await pool.query('SELECT id, full_name, avatar_url, role FROM profiles WHERE id = $1', [contactId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Contact not found' });
    res.json({ contact: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/messages/:contactId
router.get('/:contactId', requireAuth, async (req: Request, res: Response): Promise<any> => {
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

// POST /api/messages
router.post('/', requireAuth, validate(sendMessageSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const senderId = (req as any).user.id;
    const { receiver_id, content } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO messages (sender_id, receiver_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, sender_id, receiver_id, content, created_at
    `, [senderId, receiver_id, content]);

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

export default router;
