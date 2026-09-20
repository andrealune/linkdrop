import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Pool } from "pg";
import { createApp } from "../../src/app.js";
import { env } from "../../src/env.js";
import { closePool } from "../../src/db/pool.js";
import { insertLink } from "../../src/links/repository.js";
import { migrateUp } from "../../src/db/migrate.js";

/**
 * DELETE /api/links/:id (LAR-26). `env` is a shared, mutable singleton
 * (see src/env.ts) — like `checkHealth`/`createApp`'s other injectable
 * env params, but here overridden in place for the duration of this file
 * so requireAdminToken() (src/auth.ts), which reads it lazily per
 * request, sees a known token regardless of what a real .env supplies.
 */
const TEST_ADMIN_TOKEN = "test-admin-token";
const originalAdminToken = env.LINKDROP_ADMIN_TOKEN;

beforeAll(() => {
  env.LINKDROP_ADMIN_TOKEN = TEST_ADMIN_TOKEN;
});

afterAll(() => {
  env.LINKDROP_ADMIN_TOKEN = originalAdminToken;
});

describe("DELETE /api/links/:id authentication", () => {
  it("returns 401 when the Authorization header is missing", async () => {
    const app = createApp();
    const res = await request(app).delete("/api/links/1");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when the token is wrong", async () => {
    const app = createApp();
    const res = await request(app).delete("/api/links/1").set("Authorization", "Bearer wrong-token");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when the Authorization header has no Bearer prefix", async () => {
    const app = createApp();
    const res = await request(app).delete("/api/links/1").set("Authorization", TEST_ADMIN_TOKEN);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });
});

describe("DELETE /api/links/:id validation", () => {
  it("returns 400 for a non-numeric id", async () => {
    const app = createApp();
    const res = await request(app)
      .delete("/api/links/not-a-number")
      .set("Authorization", `Bearer ${TEST_ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "id must be a positive integer." });
  });
});

/**
 * Full round trip through the real database, mirroring the
 * "with DATABASE_URL" half of test/links/postLinks.test.ts.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)("DELETE /api/links/:id (with DATABASE_URL)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  afterEach(async () => {
    await pool.query("DELETE FROM links");
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it("deletes the link and returns 204", async () => {
    await migrateUp();
    const link = await insertLink({ url: "https://example.com/", title: "Example" }, pool);

    const app = createApp();
    const res = await request(app)
      .delete(`/api/links/${link.id}`)
      .set("Authorization", `Bearer ${TEST_ADMIN_TOKEN}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    const remaining = await pool.query("SELECT id FROM links WHERE id = $1", [link.id]);
    expect(remaining.rows).toHaveLength(0);
  });

  it("returns 404 when no link with that id exists", async () => {
    const app = createApp();
    const res = await request(app)
      .delete("/api/links/999999999")
      .set("Authorization", `Bearer ${TEST_ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Link not found." });
  });
});
