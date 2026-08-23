import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL environment variable is not set');
  process.exit(1);
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
