# Linkdrop web client

Vite + React 18+ + TypeScript front end for Linkdrop.

## Getting started

```bash
npm install
cp .env.example .env   # then edit VITE_API_URL if the API isn't on localhost:3001
npm run dev
```

The dev server runs at http://localhost:5173 by default.

## Scripts

| Command           | Purpose                                             |
| ------------------ | ---------------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with HMR.                  |
| `npm run build`     | Type-check (`tsc -b`) and produce a production build in `dist/`. |
| `npm run preview`   | Serve the production build locally.                  |
| `npm test`          | Run the test suite once (Vitest).                    |
| `npm run test:watch`| Run the test suite in watch mode.                    |
| `npm run lint`      | Lint the codebase (oxlint).                          |

## Environment variables

| Variable        | Required | Description                                    |
| --------------- | -------- | ----------------------------------------------- |
| `VITE_API_URL`  | yes      | Base URL of the Linkdrop API, e.g. `http://localhost:3001`. Read via `src/config/env.ts`. Falls back to `http://localhost:3001` with a console warning if unset. |

Vite only exposes environment variables that are prefixed with `VITE_` to
client-side code, and inlines them at build time — see
[Vite's env docs](https://vite.dev/guide/env-and-mode.html). Do not put
secrets in `VITE_`-prefixed variables; they end up in the built bundle.

## Project structure

```
src/
  api/            fetch wrapper + typed API calls (client.ts, health.ts, ...)
  components/     shared, reusable UI components
  config/         environment/config access (env.ts)
  hooks/          shared React hooks
  App.tsx         app shell / routing entry point
  main.tsx        React DOM entry point
```

This scaffolding only wires up the project and a health-check indicator
against `GET /api/health`; the link list, add-link form and delete/undo
flow are implemented in later tasks.
