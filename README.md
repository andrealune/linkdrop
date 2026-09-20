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

## Server scripts (`server/`)

- `npm run dev` — run the API with hot reload
- `npm run build` — compile TypeScript to `dist/`
- `npm start` — run the compiled server from `dist/`
- `npm run migrate:up` — apply pending SQL migrations
- `npm test` — run unit tests, plus integration tests against a real
  Postgres database when `DATABASE_URL` is set

## Web scripts (`web/`)

- `npm run dev` — start the Vite dev server
- `npm run build` — build for production
- `npm run preview` — preview the production build
