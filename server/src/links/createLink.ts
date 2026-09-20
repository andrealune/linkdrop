/**
 * Business logic for creating a saved link (LAR-24: POST /api/links).
 *
 * Composes the pieces built for LAR-23 — `validateUrl` and
 * `fetchPageTitle` — with `insertLink` (src/links/repository.ts):
 *  1. Validate the URL (required, <= 2048 chars, http/https, well-formed).
 *  2. Validate the title if one was supplied (<= 255 chars); otherwise
 *     fetch it from the page.
 *  3. Persist the link and return the stored row.
 *
 * Returns a discriminated result rather than throwing for expected
 * failures (bad input) so the HTTP layer (src/app.ts) can map it to the
 * right status code without a try/catch per error kind. Unexpected
 * failures (e.g. the database is unreachable) are reported as a 500
 * result rather than propagated, so a caller can't forget to handle them.
 */
import { validateUrl } from "./url.js";
import { fetchPageTitle, type FetchTitleOptions, type TitleFetchResult } from "./title.js";
import { insertLink, type InsertLinkInput, type LinkRecord } from "./repository.js";

export const MAX_TITLE_LENGTH = 255;

export interface CreateLinkInput {
  url?: unknown;
  title?: unknown;
}

export interface CreateLinkDeps {
  /** Injectable for tests; defaults to the real `fetchPageTitle`. */
  fetchTitle?: (url: string, options?: FetchTitleOptions) => Promise<TitleFetchResult>;
  /** Injectable for tests; defaults to the real `insertLink`. */
  insert?: (input: InsertLinkInput) => Promise<LinkRecord>;
}

export interface CreateLinkSuccess {
  ok: true;
  link: LinkRecord;
}

export interface CreateLinkFailure {
  ok: false;
  /** HTTP status the caller should respond with. */
  status: number;
  /** Human-readable, client-safe error message. */
  error: string;
}

export type CreateLinkResult = CreateLinkSuccess | CreateLinkFailure;

function invalid(error: string): CreateLinkFailure {
  return { ok: false, status: 400, error };
}

/**
 * Validates `rawTitle` when the client supplied one.
 *
 * Returns:
 *  - `{ ok: true, title: null }` when no usable title was supplied (absent,
 *    null, or blank) — the caller should fetch one from the page instead.
 *  - `{ ok: true, title: string }` for a valid, trimmed title.
 *  - `{ ok: false, error }` when a title was supplied but is invalid.
 */
function validateSuppliedTitle(rawTitle: unknown): { ok: true; title: string | null } | { ok: false; error: string } {
  if (rawTitle === undefined || rawTitle === null) {
    return { ok: true, title: null };
  }

  if (typeof rawTitle !== "string") {
    return { ok: false, error: "Title must be a string." };
  }

  const trimmed = rawTitle.trim();
  if (trimmed.length === 0) {
    return { ok: true, title: null };
  }

  if (trimmed.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` };
  }

  return { ok: true, title: trimmed };
}

export async function createLink(input: CreateLinkInput, deps: CreateLinkDeps = {}): Promise<CreateLinkResult> {
  const { fetchTitle = fetchPageTitle, insert = insertLink } = deps;

  const urlValidation = validateUrl(input.url);
  if (!urlValidation.valid || !urlValidation.url) {
    return invalid(urlValidation.error ?? "URL is not valid.");
  }
  const url = urlValidation.url.toString();

  const titleValidation = validateSuppliedTitle(input.title);
  if (!titleValidation.ok) {
    return invalid(titleValidation.error);
  }

  let title = titleValidation.title;
  if (title === null) {
    const fetched = await fetchTitle(url);
    title = fetched.title.length > 0 ? fetched.title.slice(0, MAX_TITLE_LENGTH) : null;
  }

  try {
    const link = await insert({ url, title });
    return { ok: true, link };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "Failed to save link."
    };
  }
}
