import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { checkHealth } from "./health.js";
import { createLink, type LinkRecord } from "./links/index.js";

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
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get("/api/health", async (_req: Request, res: Response) => {
    const health = await checkHealth();
    res.status(health.status === "ok" ? 200 : 503).json(health);
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
