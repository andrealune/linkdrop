import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { migrateUp } from "../src/db/migrate.js";
import { closePool } from "../src/db/pool.js";

/**
 * Integration test: only runs when DATABASE_URL points at a real
 * PostgreSQL instance (see README's "npm test" note). It verifies the
 * migration runner creates schema_migrations and the links table, and
 * that re-running it is a no-op (idempotent).
 *
 * Migration 0001 is actually applied by test/globalSetup.ts, once,
 * before any test file (including this one) runs — see LAR-41. So the
 * call to migrateUp() below normally finds it already applied and
 * reports it as `skipped` rather than `applied`; either way it must end
 * up recorded, which is what this asserts. Asserting `applied`
 * specifically here raced against other test files' own defensive
 * `migrateUp()` calls under Vitest's default parallel file execution:
 * whichever file's call reached the database first "won" and applied
 * it, so this test failed intermittently whenever it wasn't the winner.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)("migrateUp", () => {
  afterAll(async () => {
    await closePool();
  });

  it("creates schema_migrations and applies 0001_create_links_table.sql", async () => {
    const result = await migrateUp();
    expect([...result.applied, ...result.skipped]).toContain("0001_create_links_table.sql");

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const migrations = await pool.query(
        "SELECT id FROM schema_migrations WHERE id = $1",
        ["0001_create_links_table.sql"]
      );
      expect(migrations.rowCount).toBe(1);

      const columns = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'links'
         ORDER BY column_name`
      );
      expect(columns.rows.map((row) => row.column_name).sort()).toEqual(
        ["created_at", "id", "tags", "title", "url"].sort()
      );
    } finally {
      await pool.end();
    }
  });

  it("is idempotent: re-running applies nothing new", async () => {
    const second = await migrateUp();
    expect(second.applied).toEqual([]);
    expect(second.skipped).toContain("0001_create_links_table.sql");
  });
});

describe.skipIf(hasDatabase)("migrateUp (no DATABASE_URL)", () => {
  it("is skipped without a real database — set DATABASE_URL to run it", () => {
    expect(hasDatabase).toBe(false);
  });
});
