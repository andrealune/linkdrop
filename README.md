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
- `CORS_ORIGIN` — origins the API's CORS middleware allows to call it. `*`
  allows any origin; otherwise a comma separated list of allowed origins
  (e.g. `https://example.com,https://other.example.com`). If unset, no
  cross-origin requests are allowed.
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

- `POST /api/links` — saves a new link. Body: `{ "url": "...", "title": "..." }`
  (`title` optional — fetched from the page when omitted). Returns `201`
  with the stored link (`id`, `url`, `title`, `tags`, `created_at`), or
  `400` with `{ "error": "<message>" }` for an invalid/missing URL or an
  over-length title.

- `GET /api/links` — lists saved links newest-first (by `created_at`, with
  `id` breaking ties), 50 per page, using keyset (cursor) pagination:
  - `?tag=<tag>` — only return links tagged with `<tag>` (single tag only;
    passing the parameter more than once is a `400`).
  - `?cursor=<cursor>` — resume after the given cursor, as returned by a
    previous call.
  - Returns `200` with `{ "items": [...], "cursor": "<cursor>" | null }`.
    `items` holds up to 50 links, newest-first. `cursor` is always present
    for a consistent response shape: it's the opaque position of the last
    item in `items`, to pass as `?cursor=` on the next call — even when
    this happens to be the last page (the next call then just returns an
    empty `items`). It's only `null` when `items` is empty (nothing to
    resume from, e.g. no links match at all, or you've paged past the
    end).
  - Returns `400` with `{ "error": "<message>" }` for more than one `tag`,
    a blank `tag`, or a `cursor` that isn't one this API returned.

- `DELETE /api/links/:id` — deletes a link by id (LAR-26). Requires
  `Authorization: Bearer <LINKDROP_ADMIN_TOKEN>`:
  - Returns `204` with no body when the link is deleted.
  - Returns `401` with `{ "error": "Unauthorized" }` when the
    `Authorization` header is missing, malformed, or doesn't match
    `LINKDROP_ADMIN_TOKEN`.
  - Returns `400` with `{ "error": "id must be a positive integer." }`
    when `:id` isn't a positive integer.
  - Returns `404` with `{ "error": "Link not found." }` when no link
    with that id exists.

- `POST /api/links/:id/tags` — replaces a link's tags (LAR-27). Body:
  `{ "tags": ["..."] }`. Requires
  `Authorization: Bearer <LINKDROP_ADMIN_TOKEN>`:
  - Tags are normalized (trimmed, lowercased) before validation and
    storage; duplicates that normalize to the same value collapse to one.
  - Returns `200` with the updated link (`id`, `url`, `title`, `tags`,
    `created_at`).
  - Returns `401` with `{ "error": "Unauthorized" }` when the
    `Authorization` header is missing, malformed, or doesn't match
    `LINKDROP_ADMIN_TOKEN`.
  - Returns `400` with `{ "error": "<message>" }` when `:id` isn't a
    positive integer, `tags` isn't an array, a tag isn't a string or is
    blank, a tag contains characters other than lowercase letters, digits
    or hyphens (`a-z0-9-`), or there are more than 5 distinct tags.
  - Returns `404` with `{ "error": "Link not found." }` when no link
    with that id exists.

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
