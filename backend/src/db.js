import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgres://usuario:mM202038@localhost:5432/bolao_db';

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

export default pool;