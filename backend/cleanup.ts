import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query(`
      DELETE FROM local_users 
      WHERE id NOT IN (SELECT id FROM profiles)
      RETURNING email;
    `);
    console.log(`Deleted ${res.rowCount} orphaned accounts:`, res.rows.map(r => r.email));
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await pool.end();
  }
}
run();
