import { afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { checkHealth } from "../src/health.js";
import { closePool } from "../src/db/pool.js";

describe("checkHealth", () => {
  it("reports an error when DATABASE_URL is not set", async () => {
    const result = await checkHealth({ DATABASE_URL: undefined });

    expect(result).toEqual({
      status: "error",
      database: { status: "error", error: "DATABASE_URL is not set" }
    });
  });

  it("reports ok when DATABASE_URL is set and the query succeeds", async () => {
    const queryDatabase = vi.fn().mockResolvedValue(undefined);

    const result = await checkHealth({ DATABASE_URL: "postgres://x" }, queryDatabase);

    expect(queryDatabase).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "ok", database: { status: "ok" } });
  });

  it("reports an error with the failure message when the database query fails", async () => {
    const queryDatabase = vi.fn().mockRejectedValue(new Error("connection refused"));

    const result = await checkHealth({ DATABASE_URL: "postgres://x" }, queryDatabase);

    expect(result).toEqual({
      status: "error",
      database: { status: "error", error: "connection refused" }
    });
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    const queryDatabase = vi.fn().mockRejectedValue("boom");

    const result = await checkHealth({ DATABASE_URL: "postgres://x" }, queryDatabase);

    expect(result).toEqual({
      status: "error",
      database: { status: "error", error: "Unknown database error" }
    });
  });
});

/**
 * Integration coverage for the actual route. Like test/migrate.test.ts,
 * the "database reachable" case only runs when DATABASE_URL points at a
 * real PostgreSQL instance; otherwise we verify the endpoint correctly
 * reports the missing-configuration case.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)("GET /api/health (with DATABASE_URL)", () => {
  afterAll(async () => {
    await closePool();
  });

  it("responds 200 with an ok status when the database is reachable", async () => {
    const app = createApp();
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: { status: "ok" } });
  });
});

describe.skipIf(hasDatabase)("GET /api/health (without DATABASE_URL)", () => {
  it("responds 503 with an error status", async () => {
    const app = createApp();
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: "error",
      database: { status: "error", error: "DATABASE_URL is not set" }
    });
  });
});
