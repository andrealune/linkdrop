# Linkdrop

A tiny link-saving app: a Node/Express/TypeScript API backed by PostgreSQL,
and a React/Vite web client.

## Structure

- `server/` — Node 22 + Express + TypeScript API, PostgreSQL persistence
- `client/` — Vite + React + TypeScript client

## Prerequisites

- Node 22 (see `.nvmrc` — run `nvm use`)
- A PostgreSQL database (local or remote)

## Quick start

### 1. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your actual values:
```

Environment variables:

- `DATABASE_URL` — PostgreSQL connection string (required)
  - Example: `postgres://postgres:postgres@localhost:5432/linkdrop`
- `PORT` — port the API server listens on (required)
  - Default: `3001`
- `LINKDROP_ADMIN_TOKEN` — admin token required for DELETE and PUT endpoints (required)
  - Must be a non-empty string
  - The server exits immediately with an error if this is missing
- `CORS_ORIGIN` — origins the API's CORS middleware allows to call it
  - `*` allows any origin
  - Comma-separated list for specific origins (e.g. `https://example.com,https://other.example.com`)
  - If unset, no cross-origin requests are allowed
- `VITE_API_URL` — base URL the web client uses to reach the API (required for client)
  - Example: `http://localhost:3001`

See `.env.example` for the full list of variables.

### 2. Set up the database

First, ensure your PostgreSQL database exists. Then run migrations:

```bash
cd server
npm install
npm run migrate:up
```

This creates the `links` table and the `schema_migrations` tracking table.

### 3. Start the API server

From the `server/` directory:

```bash
npm run dev
```

The server will start on the port specified by `PORT` (default `3001`). You can
check that it's running with:

```bash
curl http://localhost:3001/api/health
```

### 4. Start the web client

In a new terminal, from the `client/` directory:

```bash
npm install
npm run dev
```

The web client will start at `http://localhost:5173` by default.

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

## API Reference

### Health check

- `GET /api/health` — health check. Returns `200` with
  `{ "status": "ok", "database": { "status": "ok" } }` when the server is
  up and it can reach PostgreSQL. Returns `503` with
  `{ "status": "error", "database": { "status": "error", "error": "<message>" } }`
  when `DATABASE_URL` is not set or the database connection/query fails.

### Links

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

- `DELETE /api/links/:id` — deletes a link by id. Requires
  `Authorization: Bearer <LINKDROP_ADMIN_TOKEN>`:
  - Returns `204` with no body when the link is deleted.
  - Returns `401` with `{ "error": "Unauthorized" }` when the
    `Authorization` header is missing, malformed, or doesn't match
    `LINKDROP_ADMIN_TOKEN`.
  - Returns `400` with `{ "error": "id must be a positive integer." }`
    when `:id` isn't a positive integer.
  - Returns `404` with `{ "error": "Link not found." }` when no link
    with that id exists.

- `POST /api/links/:id/tags` — replaces a link's tags. Body:
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

## Scripts

### Server scripts (`server/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Run the API with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server from `dist/` |
| `npm run migrate:up` | Apply pending SQL migrations from `migrations/` |
| `npm test` | Run unit tests, plus integration tests against a real Postgres database when `DATABASE_URL` is set |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Type-check the codebase |

### Client scripts (`client/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the Vite dev server with hot module replacement (HMR) |
| `npm run build` | Type-check and build for production (`dist/`) |
| `npm run preview` | Serve the production build locally for testing |
| `npm test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint the codebase (oxlint) |

## Testing

Each workspace has its own test suite:

### Server tests

From `server/`:

```bash
npm test           # run once
npm run test:watch # run in watch mode
```

Tests include:
- Unit tests for URL validation and tag normalization
- Integration tests against a real PostgreSQL database (skipped if `DATABASE_URL` is not set)

### Client tests

From `client/`:

```bash
npm test           # run once
npm run test:watch # run in watch mode
```

Tests cover:
- Form validation
- Undo flow for deletions
- Component behavior

## Development workflow

### Full local development setup

1. Install Node 22: `nvm use`
2. Set up environment: `cp .env.example .env` and edit as needed
3. Create/connect to your PostgreSQL database
4. Run migrations: `cd server && npm install && npm run migrate:up`
5. Start the server: `cd server && npm run dev`
6. In another terminal, start the client: `cd client && npm install && npm run dev`
7. Open `http://localhost:5173` in your browser

### Building for production

Server:
```bash
cd server
npm run build
npm start
```

Client:
```bash
cd client
npm run build
npm run preview
```

## Troubleshooting

### The server exits immediately with an error about missing environment variables

Make sure `.env` has values for `DATABASE_URL`, `PORT`, and `LINKDROP_ADMIN_TOKEN`.
The server requires all three to start.

### The client can't reach the API

Check that:
- The server is running on the port specified by `PORT` in `.env`
- The client's `.env` file has the correct `VITE_API_URL`
- CORS is properly configured (see `CORS_ORIGIN` in `.env.example`)

### Database migrations fail

Ensure:
- PostgreSQL is running and accessible at the URL in `DATABASE_URL`
- You have permission to create tables and modify the schema
- Try running `npm run migrate:up` again (it's safe to run multiple times)

## License

See LICENSE for details.
