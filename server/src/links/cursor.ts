/**
 * Cursor encoding/decoding for keyset-paginated link listings (LAR-25:
 * GET /api/links).
 *
 * Links are ordered newest-first by (created_at DESC, id DESC) — id is the
 * tie-breaker for rows that share a `created_at` timestamp (see
 * src/links/repository.ts). A cursor is an opaque, base64url-encoded JSON
 * object capturing both fields of the last row on a page, so the next
 * page can resume with `WHERE (created_at, id) < (cursor.created_at,
 * cursor.id)` regardless of ties.
 *
 * Cursors are treated as opaque by clients: encoding/decoding is an
 * implementation detail that can change without notice, as long as a
 * cursor returned by this API is only ever fed back into this API.
 */

export interface LinkCursor {
  createdAt: Date;
  id: string;
}

export type DecodeCursorResult =
  | { ok: true; cursor: LinkCursor | null }
  | { ok: false; error: string };

/** Encodes the position of `record` (typically the last row of a page) as an opaque cursor string. */
export function encodeCursor(record: { id: string; created_at: Date }): string {
  const payload = JSON.stringify({ id: record.id, created_at: record.created_at.toISOString() });
  return Buffer.from(payload, "utf8").toString("base64url");
}

/**
 * Decodes a `cursor` query parameter.
 *
 * Returns `{ ok: true, cursor: null }` when no cursor was supplied
 * (`undefined`) — the caller should list from the very first page.
 * Returns `{ ok: false, error }` when a cursor was supplied but isn't a
 * validly encoded cursor, so the HTTP layer can respond 400 rather than
 * run a query with garbage input.
 */
export function decodeCursor(raw: unknown): DecodeCursorResult {
  if (raw === undefined) {
    return { ok: true, cursor: null };
  }

  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, error: "cursor must be a non-empty string." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "cursor is not valid." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "cursor is not valid." };
  }

  const { id, created_at } = parsed as Record<string, unknown>;
  if (typeof id !== "string" || id.length === 0 || typeof created_at !== "string") {
    return { ok: false, error: "cursor is not valid." };
  }

  const createdAt = new Date(created_at);
  if (Number.isNaN(createdAt.getTime())) {
    return { ok: false, error: "cursor is not valid." };
  }

  return { ok: true, cursor: { createdAt, id } };
}
