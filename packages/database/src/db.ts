import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import dotenv from 'dotenv';
import * as schema from './schema/index';

dotenv.config();

const connectionString =
  process.env['DATABASE_URL'] ||
  'postgres://postgres:postgrespassword@localhost:5432/rummy_dev';

export const pool = new pg.Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

export const db = drizzle(pool, { schema });

export async function closeDb(): Promise<void> {
  await pool.end();
}
