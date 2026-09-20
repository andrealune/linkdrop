import express, { type Express, type Request, type Response } from "express";
import { checkHealth } from "./health.js";

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

  return app;
}
