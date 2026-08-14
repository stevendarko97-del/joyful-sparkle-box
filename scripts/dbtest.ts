import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const role = 'teacher';
    const email = 'testteacher' + Date.now() + '@example.com';
    
    console.log("Inserting user...");
    const userRes = await pool.query(
      'INSERT INTO local_users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, 'hash']
    );
    const user = userRes.rows[0];
    
    console.log("Inserting profile...");
    try {
      await pool.query(
        'INSERT INTO profiles (id, full_name, role, phone, bio) VALUES ($1, $2, $3, $4, $5)',
        [user.id, 'Test Teacher', role, '0241234567', 'Bio']
      );
      console.log("Profile inserted!");
    } catch (e: any) {
      console.error("Profile insert failed!", e.message);
      
      // Let's check what columns exist in profiles
      const cols = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'profiles'
      `);
      console.log("Columns in profiles:");
      console.table(cols.rows);
    }
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await pool.end();
  }
}
run();
