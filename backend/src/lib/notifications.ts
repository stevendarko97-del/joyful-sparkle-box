import { pool } from '../db';

export type NotificationType = 'payment' | 'message' | 'support' | 'booking' | 'general';

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType = 'general',
  link?: string
): Promise<void> {
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
