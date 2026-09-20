import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Pool } from "pg";
import { createApp } from "../../src/app.js";
import { env } from "../../src/env.js";
import { closePool } from "../../src/db/pool.js";
import { insertLink } from "../../src/links/repository.js";
import { migrateUp } from "../../src/db/migrate.js";

/**
 * POST /api/links/:id/tags (LAR-27). `env` is a shared, mutable
 * singleton (see src/env.ts) — like `checkHealth`/`createApp`'s other
 * injectable env params, but here overridden in place for the duration
 * of this file so requireAdminToken() (src/auth.ts), which reads it
 * lazily per request, sees a known token regardless of what a real .env
 * supplies. Mirrors test/links/deleteLinks.test.ts.
 */
const TEST_ADMIN_TOKEN = "test-admin-token";
const originalAdminToken = env.LINKDROP_ADMIN_TOKEN;

beforeAll(() => {
  env.LINKDROP_ADMIN_TOKEN = TEST_ADMIN_TOKEN;
});

afterAll(() => {
  env.LINKDROP_ADMIN_TOKEN = originalAdminToken;
});

describe("POST /api/links/:id/tags authentication", () => {
  it("returns 401 when the Authorization header is missing", async () => {
    const app = createApp();
    const res = await request(app).post("/api/links/1/tags").send({ tags: ["news"] });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when the token is wrong", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/links/1/tags")
      .set("Authorization", "Bearer wrong-token")
      .send({ tags: ["news"] });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when the Authorization header has no Bearer prefix", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/links/1/tags")
      .set("Authorization", TEST_ADMIN_TOKEN)
      .send({ tags: ["news"] });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });
});

describe("POST /api/links/:id/tags validation", () => {
  it("returns 400 for a non-numeric id", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/links/not-a-number/tags")
      .set("Authorization", `Bearer ${TEST_ADMIN_TOKEN}`)
      .send({ tags: ["news"] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "id must be a positive integer." });
  });

  it("returns 400 when tags is not an array", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/links/1/tags")
      .set("Authorization", `Bearer ${TEST_ADMIN_TOKEN}`)
      .send({ tags: "news" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "tags must be an array." });
  });

  it("returns 400 for more than 5 tags", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/links/1/tags")
      .set("Authorization", `Bearer ${TEST_ADMIN_TOKEN}`)
      .send({ tags: ["a", "b", "c", "d", "e", "f"] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "A link may have at most 5 tags." });
  });

  it("returns 400 for a tag with invalid characters", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/links/1/tags")
      .set("Authorization", `Bearer ${TEST_ADMIN_TOKEN}`)
      .send({ tags: ["Not Valid!"] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Tags may only contain lowercase letters, numbers and hyphens." });
  });
});

/**
 * Full round trip through the real database, mirroring the
 * "with DATABASE_URL" half of test/links/deleteLinks.test.ts.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)("POST /api/links/:id/tags (with DATABASE_URL)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  afterEach(async () => {
    await pool.query("DELETE FROM links");
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it("replaces the link's tags, normalizing them, and returns the updated link", async () => {
    await migrateUp();
    const link = await insertLink({ url: "https://example.com/", title: "Example" }, pool);

    const app = createApp();
    const res = await request(app)
      .post(`/api/links/${link.id}/tags`)
      .set("Authorization", `Bearer ${TEST_ADMIN_TOKEN}`)
      .send({ tags: ["  News ", "To-Read", "news"] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: link.id,
      url: link.url,
      title: link.title,
      tags: ["news", "to-read"],
      created_at: link.created_at.toISOString()
    });

    const stored = await pool.query("SELECT tags FROM links WHERE id = $1", [link.id]);
    expect(stored.rows[0].tags).toEqual(["news", "to-read"]);
  });

  it("can clear all tags by sending an empty array", async () => {
    await migrateUp();
    const link = await insertLink({ url: "https://example.com/tagged", title: "Tagged" }, pool);
    await pool.query("UPDATE links SET tags = $1 WHERE id = $2", [["news"], link.id]);

    const app = createApp();
    const res = await request(app)
      .post(`/api/links/${link.id}/tags`)
      .set("Authorization", `Bearer ${TEST_ADMIN_TOKEN}`)
      .send({ tags: [] });

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([]);
  });

  it("returns 404 when no link with that id exists", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/links/999999999/tags")
      .set("Authorization", `Bearer ${TEST_ADMIN_TOKEN}`)
      .send({ tags: ["news"] });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Link not found." });
  });
});
