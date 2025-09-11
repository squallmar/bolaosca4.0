import { Pool } from 'pg';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente apenas localmente
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

const connectionString = process.env.DATABASE_URL || 'postgres://usuario:mM202038@localhost:5432/bolao_db';

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

export default pool;