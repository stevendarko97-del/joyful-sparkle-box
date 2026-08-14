import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paystack_reference TEXT;');
    await pool.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS student_id UUID;');
    await pool.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paystack_reference TEXT;');
    await pool.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;');
    
    const { rows } = await pool.query(`
      INSERT INTO transactions (booking_id, student_id, amount_cents, status, currency, paystack_reference, transaction_date)
      SELECT id, student_id, price_cents, 'succeeded', 'GHS', COALESCE(paystack_reference, 'manual-backfill-ref'), created_at
      FROM bookings
      WHERE status IN ('confirmed', 'completed') 
        AND id NOT IN (SELECT booking_id FROM transactions WHERE booking_id IS NOT NULL)
      RETURNING id;
    `);
    console.log(`Backfilled ${rows.length} missing transactions.`);
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await pool.end();
  }
}
run();
