import express, { type Express, type Request, type Response } from "express";

/**
 * Builds the Express application. Kept separate from src/index.ts so
 * tests can import and exercise it with supertest without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  return app;
}
