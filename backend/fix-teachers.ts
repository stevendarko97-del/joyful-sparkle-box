import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query(`
      INSERT INTO teacher_profiles (user_id, video_url, background, hourly_rate_cents, years_experience, location)
      SELECT p.id, '', '', 4000, 0, ''
      FROM profiles p
      LEFT JOIN teacher_profiles tp ON p.id = tp.user_id
      WHERE p.role = 'teacher' AND tp.user_id IS NULL
      RETURNING user_id;
    `);
    console.log(`Inserted ${res.rowCount} missing teacher profiles.`);
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await pool.end();
  }
}
run();
