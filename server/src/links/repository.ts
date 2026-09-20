/**
 * Data access for the `links` table (LAR-24).
 *
 * Kept separate from the HTTP layer (src/app.ts) and from the business
 * logic that decides *what* to insert (src/links/createLink.ts) so each
 * can be tested independently: this module owns the SQL, createLink.ts
 * owns validation/title-fetching, and src/app.ts just wires HTTP to it.
 */
import type { Pool, QueryResultRow } from "pg";
import { getPool } from "../db/pool.js";

/**
 * A row from the `links` table, as returned by node-postgres.
 *
 * `id` is a string: the column is BIGSERIAL (int8), and node-postgres
 * returns int8 values as strings by default to avoid silent precision
 * loss for values beyond `Number.MAX_SAFE_INTEGER`.
 */
export interface LinkRecord extends QueryResultRow {
  id: string;
  url: string;
  title: string | null;
  tags: string[];
  created_at: Date;
}

export interface InsertLinkInput {
  url: string;
  /** null when no title was provided and none could be fetched. */
  title: string | null;
}

/** Minimal shape this module needs from a `pg.Pool` — narrow so a test double is trivial to write. */
export type QueryablePool = Pick<Pool, "query">;

/**
 * Inserts a new link and returns the stored row, including the
 * database-assigned `id`, `created_at`, and the default empty `tags`
 * array (LAR-24).
 */
export async function insertLink(
  input: InsertLinkInput,
  pool: QueryablePool = getPool()
): Promise<LinkRecord> {
  const result = await pool.query<LinkRecord>(
    `INSERT INTO links (url, title) VALUES ($1, $2)
     RETURNING id, url, title, tags, created_at`,
    [input.url, input.title]
  );
  return result.rows[0];
}
