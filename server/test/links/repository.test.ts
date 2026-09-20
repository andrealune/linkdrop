import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { insertLink } from "../../src/links/repository.js";
import { closePool } from "../../src/db/pool.js";
import { migrateUp } from "../../src/db/migrate.js";

/**
 * Integration test: only runs when DATABASE_URL points at a real
 * PostgreSQL instance (see README's "npm test" note), mirroring
 * test/migrate.test.ts and test/health.test.ts.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)("insertLink", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  afterEach(async () => {
    await pool.query("DELETE FROM links");
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it("inserts a link and returns the stored row with an empty tags array", async () => {
    await migrateUp();

    const link = await insertLink({ url: "https://example.com/", title: "Example" }, pool);

    expect(link.id).toBeTypeOf("string");
    expect(link.url).toBe("https://example.com/");
    expect(link.title).toBe("Example");
    expect(link.tags).toEqual([]);
    expect(link.created_at).toBeInstanceOf(Date);
  });

  it("stores a null title", async () => {
    const link = await insertLink({ url: "https://example.com/", title: null }, pool);

    expect(link.title).toBeNull();
  });
});
