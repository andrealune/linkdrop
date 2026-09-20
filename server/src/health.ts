/**
 * Health check logic for GET /api/health (LAR-21).
 *
 * Reports whether the server is up and whether the database is reachable:
 * - DATABASE_URL missing → { status: "error", database: { status: "error", error: "DATABASE_URL is not set" } }
 * - DATABASE_URL set but the connection/query fails → { status: "error", database: { status: "error", error: "<message>" } }
 * - DATABASE_URL set and the query succeeds → { status: "ok", database: { status: "ok" } }
 *
 * `currentEnv` and `queryDatabase` are injectable (mirroring the pattern
 * used by `assertAdminTokenPresent` in src/env.ts) so this can be unit
 * tested without a real database connection.
 */
import { env } from "./env.js";
import { getPool } from "./db/pool.js";

export interface DatabaseHealth {
  status: "ok" | "error";
  error?: string;
}

export interface HealthResult {
  status: "ok" | "error";
  database: DatabaseHealth;
}

export async function checkHealth(
  currentEnv: Pick<typeof env, "DATABASE_URL"> = env,
  queryDatabase: () => Promise<unknown> = () => getPool().query("SELECT 1")
): Promise<HealthResult> {
  if (!currentEnv.DATABASE_URL) {
    return {
      status: "error",
      database: { status: "error", error: "DATABASE_URL is not set" }
    };
  }

  try {
    await queryDatabase();
    return { status: "ok", database: { status: "ok" } };
  } catch (err) {
    return {
      status: "error",
      database: {
        status: "error",
        error: err instanceof Error ? err.message : "Unknown database error"
      }
    };
  }
}
