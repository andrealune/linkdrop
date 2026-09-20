import { afterAll, afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { Pool } from "pg";
import { createApp } from "../../src/app.js";
import { closePool } from "../../src/db/pool.js";
import { encodeCursor } from "../../src/links/cursor.js";
import { LINKS_PAGE_SIZE } from "../../src/links/listLinks.js";

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

    const oldest = await insertRow({ url: "https://example.com/oldest", createdAt: "2024-01-01T00:00:00.000Z" });
    await insertRow({ url: "https://example.com/newest", createdAt: "2024-01-02T00:00:00.000Z" });

    const res = await request(app).get("/api/links");

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { url: string }) => item.url)).toEqual([
      "https://example.com/newest",
      "https://example.com/oldest"
    ]);
    // Always present, even though this is the only/last page (LAR-25). The
    // cursor tracks the *last* link on the page — here that's the older of
    // the two, since the page is ordered newest-first.
    expect(res.body.cursor).toBe(encodeCursor({ id: oldest.id, created_at: oldest.created_at }));
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

  it(`enforces the ${LINKS_PAGE_SIZE}-item page size and returns the remainder on the next page`, async () => {
    const app = createApp();
    const total = LINKS_PAGE_SIZE + 1;
    // Distinct timestamps, oldest first, so insertion order is unambiguous
    // and doesn't depend on wall-clock timing between inserts.
    for (let i = 0; i < total; i += 1) {
      const createdAt = new Date(Date.UTC(2024, 0, 1, 0, 0, i)).toISOString();
      await insertRow({ url: `https://example.com/item-${i}`, createdAt });
    }

    const firstPage = await request(app).get("/api/links");
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.items).toHaveLength(LINKS_PAGE_SIZE);
    // Newest-first: the first page holds items total-1 down to 1, the
    // oldest (item-0) is pushed onto the second page.
    expect(firstPage.body.items[0].url).toBe(`https://example.com/item-${total - 1}`);
    expect(firstPage.body.items[LINKS_PAGE_SIZE - 1].url).toBe("https://example.com/item-1");
    expect(firstPage.body.cursor).not.toBeNull();

    const secondPage = await request(app).get("/api/links").query({ cursor: firstPage.body.cursor });
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.items[0].url).toBe("https://example.com/item-0");
    expect(secondPage.body.cursor).not.toBeNull();

    const thirdPage = await request(app).get("/api/links").query({ cursor: secondPage.body.cursor });
    expect(thirdPage.status).toBe(200);
    expect(thirdPage.body.items).toEqual([]);
    expect(thirdPage.body.cursor).toBeNull();
  });

  it("filters by tag", async () => {
    const app = createApp();
    await insertRow({ url: "https://example.com/tagged", createdAt: "2024-01-01T00:00:00.000Z", tags: ["reading"] });
    await insertRow({ url: "https://example.com/untagged", createdAt: "2024-01-02T00:00:00.000Z" });

    const res = await request(app).get("/api/links").query({ tag: "reading" });

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { url: string }) => item.url)).toEqual(["https://example.com/tagged"]);
  });

  it("combines a tag filter with cursor pagination", async () => {
    const app = createApp();
    const olderUrl = "https://example.com/older-tagged";
    const newerUrl = "https://example.com/newer-tagged";
    await insertRow({ url: "https://example.com/untagged", createdAt: "2024-01-01T18:00:00.000Z" });
    await insertRow({ url: olderUrl, createdAt: "2024-01-01T00:00:00.000Z", tags: ["reading"] });
    const newer = await insertRow({ url: newerUrl, createdAt: "2024-01-02T00:00:00.000Z", tags: ["reading"] });

    // Both tagged links fit on one page (well under LINKS_PAGE_SIZE), so
    // resuming after the newer one with the same tag filter should skip
    // straight past the untagged link and return only the older tagged one.
    const cursor = encodeCursor({ id: newer.id, created_at: newer.created_at });
    const res = await request(app).get("/api/links").query({ tag: "reading", cursor });

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { url: string }) => item.url)).toEqual([olderUrl]);
  });
});
