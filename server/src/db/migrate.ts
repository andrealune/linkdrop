/**
 * SQL migration runner.
 *
 * Applies every `*.sql` file in `server/migrations`, in filename order,
 * that has not already been recorded in the `schema_migrations` tracking
 * table. See `server/migrations/README.md` for the conventions migration
 * files follow (naming, locking/rollback/data-impact documentation).
 *
 * - `schema_migrations` itself is created here with `CREATE TABLE IF NOT
 *   EXISTS` rather than as a numbered migration file, since the tracking
 *   table must exist before any migration can be recorded in it.
 * - Each migration file runs inside its own transaction: on success, its
 *   filename is recorded in `schema_migrations` as part of that same
 *   transaction; on failure the transaction rolls back (so a partially
 *   applied file is never marked as done) and the runner stops without
 *   attempting later migrations.
 * - Migrations are forward-only (`migrate:up`). There is no automatic
 *   `migrate:down`; reverting a change means writing a new migration
 *   that undoes it.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { closePool, getPool } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This file lives at server/src/db/migrate.ts (or, once built,
// server/dist/db/migrate.js) — either way, the migrations folder is two
// levels up, at server/migrations.
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "..", "migrations");

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrationIds(client: PoolClient): Promise<Set<string>> {
  const result = await client.query<{ id: string }>("SELECT id FROM schema_migrations");
  return new Set(result.rows.map((row) => row.id));
}

async function listMigrationFiles(): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(MIGRATIONS_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
  return entries.filter((name) => name.endsWith(".sql")).sort((a, b) => a.localeCompare(b));
}

async function applyMigration(client: PoolClient, fileName: string): Promise<void> {
  const filePath = path.join(MIGRATIONS_DIR, fileName);
  const sql = await readFile(filePath, "utf8");

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [fileName]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

/**
 * Applies all pending migrations and returns which files were newly
 * applied vs. already up to date. Safe to call repeatedly (idempotent):
 * a second call with nothing new to apply returns an empty `applied`
 * list.
 */
export async function migrateUp(): Promise<MigrationResult> {
  const pool = getPool();
  const client = await pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await ensureMigrationsTable(client);
    const alreadyApplied = await getAppliedMigrationIds(client);
    const files = await listMigrationFiles();

    for (const fileName of files) {
      if (alreadyApplied.has(fileName)) {
        skipped.push(fileName);
        continue;
      }

      // eslint-disable-next-line no-console
      console.log(`Applying migration ${fileName}...`);
      await applyMigration(client, fileName);
      applied.push(fileName);
    }
  } finally {
    client.release();
  }

  return { applied, skipped };
}

async function main(): Promise<void> {
  try {
    const { applied, skipped } = await migrateUp();
    if (applied.length === 0) {
      console.log(
        skipped.length > 0
          ? `Database already up to date (${skipped.length} migration(s) applied previously).`
          : "No migration files found."
      );
    } else {
      console.log(`Applied ${applied.length} migration(s): ${applied.join(", ")}`);
    }
  } finally {
    await closePool();
  }
}

// Run only when this file is the process entrypoint (`npm run migrate:up`,
// i.e. `tsx src/db/migrate.ts` or, once built, `node dist/db/migrate.js`),
// not when `migrateUp` is imported elsewhere (e.g. by tests).
const isMain = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
