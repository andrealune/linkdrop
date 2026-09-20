import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { findLinks, insertLink } from "../../src/links/repository.js";
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

describe.runIf(hasDatabase)("findLinks", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async function insertRow(overrides: { url: string; createdAt: string; tags?: string[] }) {
    const result = await pool.query<{ id: string; created_at: Date }>(
      `INSERT INTO links (url, title, tags, created_at)
       VALUES ($1, $1, $2, $3::timestamptz)
       RETURNING id, created_at`,
      [overrides.url, overrides.tags ?? [], overrides.createdAt]
    );
    return result.rows[0];
  }

  afterEach(async () => {
    await pool.query("DELETE FROM links");
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it("lists links newest-first", async () => {
    await migrateUp();
    await insertRow({ url: "https://example.com/oldest", createdAt: "2024-01-01T00:00:00.000Z" });
    await insertRow({ url: "https://example.com/newest", createdAt: "2024-01-03T00:00:00.000Z" });
    await insertRow({ url: "https://example.com/middle", createdAt: "2024-01-02T00:00:00.000Z" });

    const links = await findLinks({ limit: 50 }, pool);

    expect(links.map((l) => l.url)).toEqual([
      "https://example.com/newest",
      "https://example.com/middle",
      "https://example.com/oldest"
    ]);
  });

  it("breaks ties on created_at using id descending", async () => {
    const sameTimestamp = "2024-01-01T00:00:00.000Z";
    const first = await insertRow({ url: "https://example.com/a", createdAt: sameTimestamp });
    const second = await insertRow({ url: "https://example.com/b", createdAt: sameTimestamp });

    const links = await findLinks({ limit: 50 }, pool);

    expect(links.map((l) => l.id)).toEqual([second.id, first.id]);
  });

  it("respects the limit", async () => {
    await insertRow({ url: "https://example.com/1", createdAt: "2024-01-01T00:00:00.000Z" });
    await insertRow({ url: "https://example.com/2", createdAt: "2024-01-02T00:00:00.000Z" });
    await insertRow({ url: "https://example.com/3", createdAt: "2024-01-03T00:00:00.000Z" });

    const links = await findLinks({ limit: 2 }, pool);

    expect(links).toHaveLength(2);
    expect(links.map((l) => l.url)).toEqual(["https://example.com/3", "https://example.com/2"]);
  });

  it("resumes after a cursor position", async () => {
    await insertRow({ url: "https://example.com/1", createdAt: "2024-01-01T00:00:00.000Z" });
    const middle = await insertRow({ url: "https://example.com/2", createdAt: "2024-01-02T00:00:00.000Z" });
    await insertRow({ url: "https://example.com/3", createdAt: "2024-01-03T00:00:00.000Z" });

    const links = await findLinks(
      { after: { createdAt: middle.created_at, id: middle.id }, limit: 50 },
      pool
    );

    expect(links.map((l) => l.url)).toEqual(["https://example.com/1"]);
  });

  it("filters by tag", async () => {
    await insertRow({ url: "https://example.com/tagged", createdAt: "2024-01-01T00:00:00.000Z", tags: ["reading"] });
    await insertRow({ url: "https://example.com/untagged", createdAt: "2024-01-02T00:00:00.000Z" });

    const links = await findLinks({ tag: "reading", limit: 50 }, pool);

    expect(links.map((l) => l.url)).toEqual(["https://example.com/tagged"]);
  });

  it("returns an empty array when there are no more links", async () => {
    const links = await findLinks({ limit: 50 }, pool);

    expect(links).toEqual([]);
  });
});
