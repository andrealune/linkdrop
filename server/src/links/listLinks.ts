/**
 * Business logic for listing saved links (LAR-25: GET /api/links).
 *
 * Composes `findLinks` (src/links/repository.ts) with the cursor
 * encoding/decoding in src/links/cursor.ts:
 *  1. Validate the optional `tag` filter (a single string, non-blank).
 *  2. Decode the optional `cursor` query parameter.
 *  3. Fetch up to `LINKS_PAGE_SIZE` links newest-first, resuming after
 *     the cursor position when one was supplied.
 *  4. Always return a `cursor` for the page — the position of the last
 *     link returned, so the caller can pass it back to fetch the next
 *     page — even when this happens to be the last page (there simply
 *     won't be any more rows the next time it's used). It's only ever
 *     `null` when the page has no links at all.
 *
 * Returns a discriminated result rather than throwing for expected
 * failures (bad input), mirroring src/links/createLink.ts, so the HTTP
 * layer can map it to the right status code without a try/catch per
 * error kind.
 */
import { findLinks, type FindLinksOptions, type LinkRecord } from "./repository.js";
import { decodeCursor, encodeCursor } from "./cursor.js";

/** Links are listed 50 at a time (LAR-25). Not configurable by the client. */
export const LINKS_PAGE_SIZE = 50;

export interface ListLinksInput {
  tag?: unknown;
  cursor?: unknown;
}

export interface ListLinksDeps {
  /** Injectable for tests; defaults to the real `findLinks`. */
  find?: (options: FindLinksOptions) => Promise<LinkRecord[]>;
}

export interface ListLinksSuccess {
  ok: true;
  links: LinkRecord[];
  /** Opaque cursor for the next page; `null` only when `links` is empty. */
  cursor: string | null;
}

export interface ListLinksFailure {
  ok: false;
  /** HTTP status the caller should respond with. */
  status: number;
  /** Human-readable, client-safe error message. */
  error: string;
}

export type ListLinksResult = ListLinksSuccess | ListLinksFailure;

function invalid(error: string): ListLinksFailure {
  return { ok: false, status: 400, error };
}

/**
 * Validates the optional `tag` query parameter.
 *
 * Express parses a repeated query parameter (`?tag=a&tag=b`) as an
 * array; this API supports filtering by a single tag only, so that case
 * is rejected rather than silently filtering on just one of them.
 */
function validateTag(rawTag: unknown): { ok: true; tag: string | undefined } | { ok: false; error: string } {
  if (rawTag === undefined) {
    return { ok: true, tag: undefined };
  }

  if (Array.isArray(rawTag)) {
    return { ok: false, error: "Only one tag may be specified." };
  }

  if (typeof rawTag !== "string") {
    return { ok: false, error: "tag must be a string." };
  }

  const trimmed = rawTag.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "tag must not be blank." };
  }

  return { ok: true, tag: trimmed };
}

export async function listLinks(input: ListLinksInput, deps: ListLinksDeps = {}): Promise<ListLinksResult> {
  const { find = findLinks } = deps;

  const tagValidation = validateTag(input.tag);
  if (!tagValidation.ok) {
    return invalid(tagValidation.error);
  }

  const cursorResult = decodeCursor(input.cursor);
  if (!cursorResult.ok) {
    return invalid(cursorResult.error);
  }

  try {
    const links = await find({
      tag: tagValidation.tag,
      after: cursorResult.cursor,
      limit: LINKS_PAGE_SIZE
    });

    const lastLink = links.length > 0 ? links[links.length - 1] : undefined;
    const cursor = lastLink ? encodeCursor(lastLink) : null;

    return { ok: true, links, cursor };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "Failed to list links."
    };
  }
}
