# Migrations

Plain SQL migrations for the Linkdrop PostgreSQL database, applied by
`npm run migrate:up` (see `server/src/db/migrate.ts`).

## How it works

- Each file here is a plain `.sql` script, named `NNNN_description.sql`
  (a zero-padded sequence number followed by a short description).
- `migrate:up` reads every `*.sql` file in this folder, sorted by
  filename, and applies each one that is not yet recorded in the
  `schema_migrations` tracking table.
- `schema_migrations` is created automatically (`CREATE TABLE IF NOT
  EXISTS`) the first time the runner connects — it is not itself a
  numbered migration, since it must exist before any migration can be
  recorded. Its schema is:

  | column       | type        | notes                              |
  |--------------|-------------|-------------------------------------|
  | `id`         | `text`      | primary key; the migration filename |
  | `applied_at` | `timestamptz` | defaults to `now()`               |

- Each migration file runs inside its own transaction. On success, its
  filename is inserted into `schema_migrations` as part of the same
  transaction (so a crash mid-file cannot leave a migration half-applied
  and marked as done). On failure, that migration's transaction is rolled
  back and the runner stops — later migrations are not attempted.
- Migrations are **forward-only**: there is no automatic `migrate:down`.
  To revert a change, write a new migration file that undoes it, rather
  than editing or deleting an applied one.

## Writing a new migration

1. Add a new file named with the next sequence number, e.g.
   `0002_add_links_url_unique_index.sql`.
2. At the top of the file, document in comments:
   - **Locking behaviour** — which locks the statements take and on what
     (e.g. `CREATE INDEX CONCURRENTLY` to avoid blocking writes on a large
     table, vs. a plain `ALTER TABLE ... ADD COLUMN` which takes a brief
     `ACCESS EXCLUSIVE` lock but is fast when there's no default requiring
     a rewrite).
   - **Rollback path** — the manual SQL (and `schema_migrations` cleanup)
     to reverse this change if needed, since there is no automatic down
     migration.
   - **Data impact** — whether existing rows are read, rewritten or
     deleted, and roughly how that scales with table size.
3. Never edit a migration file that has already been applied anywhere
   (including in a merged PR) — add a new migration instead.
4. Run `npm run migrate:up` locally against a throwaway database to
   verify it applies cleanly before opening a PR.

## Current migrations

- `0001_create_links_table.sql` — creates the `links` table
  (`id`, `url`, `title`, `tags`, `created_at`) with a `created_at` index
  for listing and a GIN index on `tags` for tag filtering.
