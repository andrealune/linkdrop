import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { env, type CorsOrigin } from "./env.js";
import { requireAdminToken } from "./auth.js";
import { checkHealth } from "./health.js";
import { createLink, deleteLink, listLinks, updateLinkTags, type LinkRecord } from "./links/index.js";

/** Shapes a stored link row into the JSON the API returns (LAR-24). */
function toLinkResponse(link: LinkRecord) {
  return {
    id: link.id,
    url: link.url,
    title: link.title,
    created_at: link.created_at,
    tags: link.tags
  };
}

/**
 * Builds the Express application. Kept separate from src/index.ts so
 * tests can import and exercise it with supertest without binding a port.
 *
 * `corsOrigin` is injectable (mirroring the pattern used by `checkHealth`
 * in src/health.ts) so CORS behaviour can be unit tested for several
 * CORS_ORIGIN values without relying on process.env at module load time.
 */
export function createApp(corsOrigin: CorsOrigin = env.CORS_ORIGIN): Express {
  const app = express();

  // Allows the web app to call the API from another origin (LAR-40). Which
  // origins are allowed comes from CORS_ORIGIN (see src/env.ts): "*" allows
  // any origin, otherwise only the configured comma separated list gets the
  // Access-Control-Allow-Origin header. Registered before the routes so it
  // also covers the browser's OPTIONS preflight for them.
  app.use(
    cors({
      origin: corsOrigin,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"]
    })
  );

  app.use(express.json());

  app.get("/api/health", async (_req: Request, res: Response) => {
    const health = await checkHealth();
    res.status(health.status === "ok" ? 200 : 503).json(health);
  });

  app.get("/api/links", async (req: Request, res: Response) => {
    const result = await listLinks({ tag: req.query.tag, cursor: req.query.cursor });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(200).json({
      items: result.links.map(toLinkResponse),
      cursor: result.cursor
    });
  });

  app.post("/api/links", async (req: Request, res: Response) => {
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const result = await createLink(body);

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(201).json(toLinkResponse(result.link));
  });

  // Deletes a link by id (LAR-26). Requires a valid admin bearer token —
  // requireAdminToken() responds 401 and short-circuits before this
  // handler runs when the Authorization header is missing or wrong.
  app.delete("/api/links/:id", requireAdminToken(), async (req: Request, res: Response) => {
    const result = await deleteLink(req.params.id);

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(204).send();
  });

  // Replaces a link's tags (LAR-27). Requires a valid admin bearer token —
  // requireAdminToken() responds 401 and short-circuits before this
  // handler runs when the Authorization header is missing or wrong.
  // Tags are normalized (trimmed, lowercased) and validated (max 5,
  // `a-z0-9-` only) by updateLinkTags(); this handler just wires the
  // request/response.
  app.post("/api/links/:id/tags", requireAdminToken(), async (req: Request, res: Response) => {
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const result = await updateLinkTags(req.params.id, body);

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(200).json(toLinkResponse(result.link));
  });

  // Handles malformed JSON bodies raised by express.json() (which throws a
  // SyntaxError from the middleware above) with the same { error } shape
  // the rest of the API uses, instead of Express's default HTML response.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && "status" in err && (err as { status?: number }).status === 400) {
      res.status(400).json({ error: "Request body must be valid JSON." });
      return;
    }
    next(err);
  });

  return app;
}
