import { afterAll, afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { Pool } from "pg";
import { createApp } from "../../src/app.js";
import { closePool } from "../../src/db/pool.js";
import { encodeCursor } from "../../src/links/cursor.js";

/**
 * Validation failures are handled entirely by listLinks() before it
 * touches the database (see src/links/listLinks.ts), so these run
 * regardless of DATABASE_URL — mirroring test/links/postLinks.test.ts.
 */
describe("GET /api/links validation", () => {
  it("rejects more than one tag", async () => {
    const app = createApp();
    const res = await request(app).get("/api/links").query("tag=a&tag=b");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Only one tag may be specified." });
  });

  it("rejects a blank tag", async () => {
    const app = createApp();
    const res = await request(app).get("/api/links").query({ tag: "   " });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "tag must not be blank." });
  });

  it("rejects an invalid cursor", async () => {
    const app = createApp();
    const res = await request(app).get("/api/links").query({ cursor: "not-a-real-cursor!!!" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "cursor is not valid." });
  });
});

/**
 * Full round trip through the real database, mirroring the
 * "with DATABASE_URL" half of test/links/postLinks.test.ts.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)("GET /api/links (with DATABASE_URL)", () => {
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

  it("returns links newest-first with a cursor, and an empty items array with a null cursor when there are none", async () => {
    const app = createApp();

    const empty = await request(app).get("/api/links");
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ items: [], cursor: null });

    await insertRow({ url: "https://example.com/oldest", createdAt: "2024-01-01T00:00:00.000Z" });
    const newest = await insertRow({ url: "https://example.com/newest", createdAt: "2024-01-02T00:00:00.000Z" });

    const res = await request(app).get("/api/links");

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { url: string }) => item.url)).toEqual([
      "https://example.com/newest",
      "https://example.com/oldest"
    ]);
    // Always present, even though this is the only/last page (LAR-25).
    expect(res.body.cursor).toBe(encodeCursor({ id: newest.id, created_at: newest.created_at }));
  });

  it("paginates using the returned cursor", async () => {
    const app = createApp();
    for (let i = 0; i < 3; i += 1) {
      await insertRow({ url: `https://example.com/${i}`, createdAt: `2024-01-0${i + 1}T00:00:00.000Z` });
    }

    const firstPage = await request(app).get("/api/links");
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.items).toHaveLength(3);
    expect(firstPage.body.cursor).not.toBeNull();

    const secondPage = await request(app).get("/api/links").query({ cursor: firstPage.body.cursor });
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.items).toEqual([]);
    expect(secondPage.body.cursor).toBeNull();
  });

  it("filters by tag", async () => {
    const app = createApp();
    await insertRow({ url: "https://example.com/tagged", createdAt: "2024-01-01T00:00:00.000Z", tags: ["reading"] });
    await insertRow({ url: "https://example.com/untagged", createdAt: "2024-01-02T00:00:00.000Z" });

    const res = await request(app).get("/api/links").query({ tag: "reading" });

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { url: string }) => item.url)).toEqual(["https://example.com/tagged"]);
  });
});
