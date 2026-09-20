import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { extractBearerToken, requireAdminToken } from "../src/auth.js";

/**
 * Unit coverage for the admin token check used by DELETE /api/links/:id
 * (LAR-26). `requireAdminToken` takes an injectable `currentEnv`
 * (mirroring `checkHealth` in src/health.ts) so this runs without
 * depending on process.env.LINKDROP_ADMIN_TOKEN.
 */
function mockReq(authorization?: string): Request {
  return {
    header: (name: string) => (name.toLowerCase() === "authorization" ? authorization : undefined)
  } as unknown as Request;
}

function mockRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  } as unknown as Response;
}

describe("extractBearerToken", () => {
  it("returns the token from a well-formed Bearer header", () => {
    expect(extractBearerToken("Bearer secret-token")).toBe("secret-token");
  });

  it("returns null when the header is missing", () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it("returns null when the header has no Bearer prefix", () => {
    expect(extractBearerToken("secret-token")).toBeNull();
  });

  it("returns null when the token portion is blank", () => {
    expect(extractBearerToken("Bearer ")).toBeNull();
  });

  it("is case-sensitive about the Bearer prefix", () => {
    expect(extractBearerToken("bearer secret-token")).toBeNull();
  });
});

describe("requireAdminToken", () => {
  const currentEnv = { LINKDROP_ADMIN_TOKEN: "correct-token" };

  it("calls next() when the bearer token matches LINKDROP_ADMIN_TOKEN", () => {
    const req = mockReq("Bearer correct-token");
    const res = mockRes();
    const next = vi.fn();

    requireAdminToken(currentEnv)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("responds 401 when the Authorization header is missing", () => {
    const req = mockReq(undefined);
    const res = mockRes();
    const next = vi.fn();

    requireAdminToken(currentEnv)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("responds 401 when the token does not match", () => {
    const req = mockReq("Bearer wrong-token");
    const res = mockRes();
    const next = vi.fn();

    requireAdminToken(currentEnv)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("responds 401 when the header is missing the Bearer prefix", () => {
    const req = mockReq("correct-token");
    const res = mockRes();
    const next = vi.fn();

    requireAdminToken(currentEnv)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("responds 401 when the supplied token is a different length than the configured one", () => {
    const req = mockReq("Bearer correct-tok");
    const res = mockRes();
    const next = vi.fn();

    requireAdminToken(currentEnv)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("responds 401 when the supplied token is longer than the configured one", () => {
    const req = mockReq("Bearer correct-tokenextra");
    const res = mockRes();
    const next = vi.fn();

    requireAdminToken(currentEnv)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("responds 401 when LINKDROP_ADMIN_TOKEN is not configured, even with a token supplied", () => {
    const req = mockReq("Bearer anything");
    const res = mockRes();
    const next = vi.fn();

    requireAdminToken({ LINKDROP_ADMIN_TOKEN: undefined })(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
