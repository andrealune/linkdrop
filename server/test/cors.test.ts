import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

/**
 * CORS behaviour (LAR-40). createApp() takes an injectable corsOrigin
 * (mirroring the pattern used by checkHealth in src/health.ts) so each
 * scenario can be exercised without depending on process.env.CORS_ORIGIN.
 */
describe("CORS", () => {
  it("sets Access-Control-Allow-Origin for an allowed origin", async () => {
    const app = createApp(["https://allowed.example"]);

    const res = await request(app).get("/api/health").set("Origin", "https://allowed.example");

    expect(res.headers["access-control-allow-origin"]).toBe("https://allowed.example");
  });

  it("does not set Access-Control-Allow-Origin for an origin that isn't allowed", async () => {
    const app = createApp(["https://allowed.example"]);

    const res = await request(app).get("/api/health").set("Origin", "https://evil.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("supports a comma separated list of allowed origins", async () => {
    const app = createApp(["https://a.example", "https://b.example"]);

    const resA = await request(app).get("/api/health").set("Origin", "https://a.example");
    const resB = await request(app).get("/api/health").set("Origin", "https://b.example");
    const resC = await request(app).get("/api/health").set("Origin", "https://c.example");

    expect(resA.headers["access-control-allow-origin"]).toBe("https://a.example");
    expect(resB.headers["access-control-allow-origin"]).toBe("https://b.example");
    expect(resC.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it('allows any origin when CORS_ORIGIN is "*"', async () => {
    const app = createApp("*");

    const res = await request(app).get("/api/health").set("Origin", "https://anything.example");

    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("allows no origin when nothing is configured", async () => {
    const app = createApp([]);

    const res = await request(app).get("/api/health").set("Origin", "https://anything.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers an OPTIONS preflight with 204 and the allowed methods and headers", async () => {
    const app = createApp(["https://allowed.example"]);

    const res = await request(app)
      .options("/api/links")
      .set("Origin", "https://allowed.example")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Authorization,Content-Type");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-methods"]).toBe("GET,POST,DELETE,OPTIONS");
    expect(res.headers["access-control-allow-headers"]).toBe("Authorization,Content-Type");
    expect(res.headers["access-control-allow-origin"]).toBe("https://allowed.example");
  });

  it("still answers an OPTIONS preflight with 204 for an origin that isn't allowed", async () => {
    const app = createApp(["https://allowed.example"]);

    const res = await request(app)
      .options("/api/links")
      .set("Origin", "https://evil.example")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Authorization,Content-Type");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-methods"]).toBe("GET,POST,DELETE,OPTIONS");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
