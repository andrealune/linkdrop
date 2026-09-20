# Linkdrop

A tiny link-saving app: a Node/Express/TypeScript API backed by PostgreSQL,
and a React/Vite web client.

## Structure

- `server/` — Node 22 + Express + TypeScript API, PostgreSQL persistence
- `web/` — Vite + React + TypeScript client

## Prerequisites

- Node 22 (see `.nvmrc` — run `nvm use`)
- A PostgreSQL database

## Getting started

```bash
cp .env.example .env
# edit .env with real values, then:

cd server
npm install
npm run migrate:up
npm run dev
```

Environment variables (see `.env.example`):

- `DATABASE_URL` — PostgreSQL connection string
- `PORT` — port the API server listens on
- `LINKDROP_ADMIN_TOKEN` — admin token required for destructive/tag-editing
  endpoints (sent as `Authorization: Bearer <token>`)
- `VITE_API_URL` — base URL the web client uses to reach the API

The server exits immediately with a descriptive error message if any of
`DATABASE_URL`, `PORT` or `LINKDROP_ADMIN_TOKEN` is missing.

## Database schema and migrations

Schema changes live as plain SQL files in `server/migrations/`, applied in
filename order by `npm run migrate:up` (`server/src/db/migrate.ts`). A
`schema_migrations` table (`id` = migration filename, `applied_at`) tracks
which files have already run, so `migrate:up` is safe to run repeatedly —
it only applies files it hasn't seen before. See
`server/migrations/README.md` for the full convention (naming, and the
locking/rollback/data-impact notes every migration should document).

Current schema:

- **`links`** — a saved URL: `id` (bigserial PK), `url` (text, required),
  `title` (text, optional), `tags` (text array, defaults to empty),
  `created_at` (timestamptz, defaults to now). Indexed on `created_at`
  (recent-first listing) and on `tags` with a GIN index (tag filtering).

## API

- `GET /api/health` — health check. Returns `200` with
  `{ "status": "ok", "database": { "status": "ok" } }` when the server is
  up and it can reach PostgreSQL. Returns `503` with
  `{ "status": "error", "database": { "status": "error", "error": "<message>" } }`
  when `DATABASE_URL` is not set or the database connection/query fails.

## Server scripts (`server/`)

- `npm run dev` — run the API with hot reload
- `npm run build` — compile TypeScript to `dist/`
- `npm start` — run the compiled server from `dist/`
- `npm run migrate:up` — apply pending SQL migrations from `migrations/`
- `npm test` — run unit tests, plus integration tests against a real
  Postgres database when `DATABASE_URL` is set

## Web scripts (`web/`)

- `npm run dev` — start the Vite dev server
- `npm run build` — build for production
- `npm run preview` — preview the production build
