import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const email = 'admin@quicktutor.com';
    const password = 'adminpassword';
    
    // Check if admin exists
    const check = await pool.query('SELECT id FROM local_users WHERE email = $1', [email]);
    if (check.rows.length > 0) {
      console.log(`Admin account already exists! Login with: ${email} / ${password}`);
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userRes = await pool.query(
      'INSERT INTO local_users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, password_hash]
    );
    const userId = userRes.rows[0].id;
    
    await pool.query(
      "INSERT INTO profiles (id, full_name, role) VALUES ($1, 'System Admin', 'admin')",
      [userId]
    );

    console.log(`\n✅ Admin account created successfully!`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}\n`);
    
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await pool.end();
  }
}
run();
