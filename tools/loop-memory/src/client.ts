import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index';
import { trustedDatabaseConfig } from '../hooks/lib/load-dotenv.mjs';
import { MemoryError } from './store';

export type LoopDb = NodePgDatabase<typeof schema>;

// Legacy explicit-library example value. Automatic connections never default to this endpoint.
export const LOOP_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5434/loop_memory';

export function createLoopDb(connectionString?: string): {
  db: LoopDb;
  pool: Pool;
} {
  // Explicit library callers own their endpoint (including disposable integration fixtures).
  // Automatic CLI/hooks never pass a URL and cannot select one through ambient environment.
  let config;
  try { config = connectionString === undefined ? trustedDatabaseConfig(process.cwd()) : undefined; }
  catch (e) { throw new MemoryError((e as Error).message); }
  const pool = new Pool({ ...(config ? { ...config, password: () => config.password,
    client_encoding: 'UTF8', application_name: 'loop-memory', sslnegotiation: 'postgres' } : { connectionString }),
    connectionTimeoutMillis: 3000, statement_timeout: 5000 });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
