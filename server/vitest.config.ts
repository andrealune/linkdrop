import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Several test files run integration tests against a real Postgres
    // database (via DATABASE_URL) and share state with it: the `links`
    // table itself, and (until this file's `globalSetup` was added) the
    // migration run that creates it. Under Vitest's default parallel
    // file execution, different files' test cases interleave against
    // that *same* database — e.g. one file's insert becomes visible to
    // another file's "the table is empty" assertion — producing
    // intermittent, scheduling-dependent failures unrelated to any real
    // regression (LAR-41). Running test files sequentially removes that
    // class of race entirely.
    fileParallelism: false,
    // Applies pending migrations once, before any test file runs, so
    // schema creation can't race with (or depend on the scheduling of)
    // individual test files' own defensive `migrateUp()` calls — see
    // test/globalSetup.ts and LAR-41 for the failure this fixes.
    globalSetup: ["./test/globalSetup.ts"]
  }
});
