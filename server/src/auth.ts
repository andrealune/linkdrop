/**
 * Admin token authentication for mutating/administrative endpoints
 * (LAR-26), e.g. `DELETE /api/links/:id`.
 *
 * Callers must send `Authorization: Bearer <LINKDROP_ADMIN_TOKEN>`. When
 * the header is missing, malformed, or doesn't match the configured
 * token, the request is rejected with 401 before it reaches the route
 * handler.
 *
 * `LINKDROP_ADMIN_TOKEN` itself is required to be set at process startup
 * (see `assertAdminTokenPresent` in src/env.ts) — if it were unset here,
 * every request would be rejected regardless of what the client sends,
 * so there is no "auth disabled" fallback to worry about.
 */
import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "./env.js";

const BEARER_PREFIX = "Bearer ";

/** Extracts the token from an `Authorization: Bearer <token>` header value, if well-formed. */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Constant-time string comparison (LAR-39). `token !== expected` short
 * circuits on the first differing byte, which leaks how many leading
 * characters of the guess were correct through response timing. The
 * token gates destructive/admin endpoints that may be reachable over the
 * network (CORS_ORIGIN can be "*"), so we compare digests of equal
 * length with `crypto.timingSafeEqual` instead of the raw strings —
 * `timingSafeEqual` itself throws if the buffers differ in length, so
 * that check happens first (and is *not* timing sensitive: it only
 * reveals the length of the correct token, not any of its content).
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");

  if (bufA.length !== bufB.length) {
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

/**
 * Express middleware enforcing the admin token. Injectable `currentEnv`
 * mirrors the pattern used by `checkHealth` (src/health.ts) so this can
 * be unit tested without mutating `process.env`.
 */
export function requireAdminToken(
  currentEnv: Pick<typeof env, "LINKDROP_ADMIN_TOKEN"> = env
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearerToken(req.header("authorization"));
    const expected = currentEnv.LINKDROP_ADMIN_TOKEN;

    if (!expected || !token || !safeCompare(token, expected)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
  };
}
