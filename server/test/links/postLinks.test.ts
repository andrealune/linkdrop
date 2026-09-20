import { afterAll, afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { Pool } from "pg";
import { createApp } from "../../src/app.js";
import { closePool } from "../../src/db/pool.js";
import { MAX_TITLE_LENGTH } from "../../src/links/createLink.js";
import { MAX_URL_LENGTH } from "../../src/links/url.js";

/**
 * Validation failures are handled entirely by createLink() before it
 * touches the database (see src/links/createLink.ts), so these run
 * regardless of DATABASE_URL — mirroring the "without DATABASE_URL"
 * half of test/health.test.ts.
 */
describe("POST /api/links validation", () => {
  it("returns 400 when the URL is missing", async () => {
    const app = createApp();
    const res = await request(app).post("/api/links").send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "URL is required." });
  });

  it("returns 400 for a malformed URL", async () => {
    const app = createApp();
    const res = await request(app).post("/api/links").send({ url: "not a url" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "URL is not valid." });
  });

  it(`returns 400 for a URL longer than ${MAX_URL_LENGTH} characters`, async () => {
    const app = createApp();
    const longUrl = `https://example.com/${"a".repeat(MAX_URL_LENGTH)}`;
    const res = await request(app).post("/api/links").send({ url: longUrl });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: `URL must be ${MAX_URL_LENGTH} characters or fewer.` });
  });

  it(`returns 400 for a title longer than ${MAX_TITLE_LENGTH} characters`, async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/links")
      .send({ url: "https://example.com", title: "a".repeat(MAX_TITLE_LENGTH + 1) });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` });
  });

  it("returns 400 for a malformed JSON body", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/links")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Request body must be valid JSON." });
  });
});

/**
 * Full round trip through the real database, mirroring the
 * "with DATABASE_URL" half of test/health.test.ts. A title is always
 * supplied here so the test doesn't depend on outbound network access;
 * fetchPageTitle itself is covered separately in test/links/title.test.ts
 * and its use from createLink() in test/links/createLink.test.ts.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)("POST /api/links (with DATABASE_URL)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // This describe block used to insert a row through the real endpoint
  // without ever deleting it, unlike every other real-database describe
  // in this suite (test/links/getLinks.test.ts,
  // test/links/deleteLinks.test.ts, test/links/postLinksTags.test.ts,
  // test/links/repository.test.ts all clean up in `afterEach`). The
  // leftover "https://example.com/page" row then polluted any later run
  // — in the same `npm test` invocation or a later one against a
  // long-lived database — that assumed the `links` table started empty
  // (observed failing test/links/getLinks.test.ts's "returns ... an
  // empty items array" case while reproducing LAR-41).
  afterEach(async () => {
    await pool.query("DELETE FROM links");
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it("stores the link and returns it with an id, created_at, and empty tags", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/links")
      .send({ url: "https://example.com/page", title: "Example Page" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      url: "https://example.com/page",
      title: "Example Page",
      tags: []
    });
    expect(res.body.id).toBeDefined();
    expect(res.body.created_at).toBeDefined();
  });
});
