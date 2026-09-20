/**
 * Shared PostgreSQL connection pool.
 *
 * A single `pg.Pool` is created lazily (on first use) from
 * `DATABASE_URL`, and reused by the migration runner and, later, by the
 * application's data-access code. Call `closePool()` when a process is
 * about to exit (e.g. after `migrate:up` finishes, or in test teardown)
 * so it doesn't hang waiting for idle connections to close.
 */
import { Pool } from "pg";
import { env } from "../env.js";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    if (!env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and set it before running database operations."
      );
    }
    pool = new Pool({ connectionString: env.DATABASE_URL });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    const current = pool;
    pool = undefined;
    await current.end();
  }
}
