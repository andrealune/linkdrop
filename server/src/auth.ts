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
 * Express middleware enforcing the admin token. Injectable `currentEnv`
 * mirrors the pattern used by `checkHealth` (src/health.ts) so this can
 * be unit tested without mutating `process.env`.
 */
export function requireAdminToken(
  currentEnv: Pick<typeof env, "LINKDROP_ADMIN_TOKEN"> = env
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearerToken(req.header("authorization"));

    if (!currentEnv.LINKDROP_ADMIN_TOKEN || !token || token !== currentEnv.LINKDROP_ADMIN_TOKEN) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
  };
}
