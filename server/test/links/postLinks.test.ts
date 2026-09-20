import { afterAll, afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { Pool } from "pg";
import { createServer, type Server } from "node:http";
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
 * "with DATABASE_URL" half of test/health.test.ts. Most cases here
 * supply a title explicitly so they don't depend on outbound network
 * access; fetchPageTitle itself is covered separately in
 * test/links/title.test.ts and its use from createLink() in
 * test/links/createLink.test.ts (both with an injected fetch double).
 *
 * The "fetches the page title" case below instead exercises the real,
 * un-mocked title-fetch path end to end — HTTP route -> createLink() ->
 * the default fetchPageTitle() -> a real (loopback) HTTP request -> the
 * database — against a throwaway local HTTP server, so it stays fast and
 * deterministic without reaching the public internet.
 *
 * `afterEach` clears the table (mirroring test/links/getLinks.test.ts and
 * friends) so rows created here don't leak into other test files when the
 * whole suite runs together against one database.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)("POST /api/links (with DATABASE_URL)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

  it("fetches the page title from the URL when none is supplied, and stores it", async () => {
    let server: Server | undefined;
    try {
      server = createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><head><title>Local Test Page</title></head><body></body></html>");
      });
      await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Expected the test server to bind to a port.");
      }
      const url = `http://127.0.0.1:${address.port}/`;

      const app = createApp();
      const res = await request(app).post("/api/links").send({ url });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Local Test Page");
      expect(res.body.url).toBe(url);
    } finally {
      await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    }
  });
});
