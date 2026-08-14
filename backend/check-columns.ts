import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'teacher_profiles'
    `);
    console.log("Columns in teacher_profiles:");
    console.table(cols.rows);
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await pool.end();
  }
}
run();
