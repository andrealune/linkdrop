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

export interface FindLinksOptions {
  /** When set, only links tagged with this exact tag are returned. */
  tag?: string;
  /**
   * When set, only links strictly "older" (in newest-first order) than
   * this position are returned — i.e. the row after this one on a
   * `created_at DESC, id DESC` listing. `null`/omitted starts from the
   * very first page.
   */
  after?: { createdAt: Date; id: string } | null;
  /** Maximum number of rows to return. */
  limit: number;
}

/**
 * Lists links newest-first (`created_at DESC`, with `id DESC` as a
 * tie-breaker for rows sharing a `created_at`), optionally filtered by a
 * single tag and/or resumed after a keyset cursor position (LAR-25).
 *
 * Uses a row-value comparison (`(created_at, id) < (...)`) rather than
 * an OFFSET so pages remain stable and cheap (via `idx_links_created_at`)
 * even as new links are inserted between requests.
 */
export async function findLinks(
  options: FindLinksOptions,
  pool: QueryablePool = getPool()
): Promise<LinkRecord[]> {
  const { tag, after, limit } = options;
  const result = await pool.query<LinkRecord>(
    `SELECT id, url, title, tags, created_at
     FROM links
     WHERE ($1::text IS NULL OR tags @> ARRAY[$1]::text[])
       AND (
         $2::timestamptz IS NULL
         OR (created_at, id) < ($2::timestamptz, $3::bigint)
       )
     ORDER BY created_at DESC, id DESC
     LIMIT $4`,
    [tag ?? null, after ? after.createdAt.toISOString() : null, after ? after.id : null, limit]
  );
  return result.rows;
}

/**
 * Deletes the link with the given id (LAR-26). Returns `true` when a row
 * was deleted, `false` when no link with that id existed.
 */
export async function deleteLinkById(id: string, pool: QueryablePool = getPool()): Promise<boolean> {
  const result = await pool.query("DELETE FROM links WHERE id = $1::bigint", [id]);
  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Replaces the tag set of the link with the given id (LAR-27). `tags` is
 * expected to already be validated/normalized (see
 * src/links/updateLinkTags.ts) — this function just persists it. Returns
 * the updated row, or `null` when no link with that id existed.
 */
export async function updateLinkTags(
  id: string,
  tags: string[],
  pool: QueryablePool = getPool()
): Promise<LinkRecord | null> {
  const result = await pool.query<LinkRecord>(
    `UPDATE links SET tags = $2::text[] WHERE id = $1::bigint
     RETURNING id, url, title, tags, created_at`,
    [id, tags]
  );
  return result.rows[0] ?? null;
}
