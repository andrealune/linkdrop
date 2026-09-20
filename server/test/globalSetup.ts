/**
 * Vitest `globalSetup`: runs once for the whole `vitest run` invocation,
 * before any test file (and before Vitest spins up its worker pool for
 * them), regardless of file parallelism.
 *
 * Several integration test files (test/migrate.test.ts,
 * test/links/repository.test.ts, test/links/deleteLinks.test.ts,
 * test/links/postLinksTags.test.ts) need the `links`/`schema_migrations`
 * tables to exist before they run, and used to call `migrateUp()`
 * themselves to guarantee that. With Vitest's default parallel file
 * execution, that raced: whichever file's call reached the database
 * first actually applied migration 0001, so test/migrate.test.ts's
 * assertion that *it* applied it (`applied` contains the filename) failed
 * whenever another file's worker won the race. A second group of files
 * (test/health.test.ts, test/links/getLinks.test.ts,
 * test/links/postLinks.test.ts) never called `migrateUp()` at all and
 * relied on one of the others having done it first — so schema creation
 * was both racy *and* implicitly ordering-dependent.
 *
 * Running the migration exactly once here removes both problems: by the
 * time any test file's code runs, the schema already exists, and no two
 * test files' `migrateUp()` calls (the remaining ones are harmless no-ops
 * — `migrateUp()` is idempotent) can race to apply it.
 *
 * A no-op when DATABASE_URL is not set, mirroring the `describe.runIf` /
 * `describe.skipIf(hasDatabase)` pattern the test files already use.
 */
import { migrateUp } from "../src/db/migrate.js";
import { closePool } from "../src/db/pool.js";

export default async function setup(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  await migrateUp();
  // Global setup runs in its own process/context, separate from the
  // worker(s) that run the actual test files: close the pool it opened
  // here so this step doesn't keep the process alive waiting on it. Each
  // test file gets its own pool (via src/db/pool.ts's lazily created,
  // per-context singleton) when it needs one.
  await closePool();
}
