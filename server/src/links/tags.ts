/**
 * Tag normalization utility (LAR-28).
 *
 * Extracted out of `updateLinkTags.ts` (LAR-27) so the normalization
 * rules — lowercase, `a-z0-9-` only, de-duplicated, at most `MAX_TAGS`
 * entries — live in one place and can be unit tested on their own,
 * independent of the HTTP/business-logic layer that currently is the
 * only caller (`POST /api/links/:id/tags`).
 */

/** A link may have at most this many tags (LAR-27). */
export const MAX_TAGS = 5;

/** Tags are stored lowercase and may only contain letters, digits and hyphens. */
const TAG_PATTERN = /^[a-z0-9-]+$/;

export interface NormalizeTagsSuccess {
  ok: true;
  tags: string[];
}

export interface NormalizeTagsFailure {
  ok: false;
  error: string;
}

export type NormalizeTagsResult = NormalizeTagsSuccess | NormalizeTagsFailure;

/**
 * Validates and normalizes a `tags` input of unknown shape.
 *
 * - Must be an array; anything else is rejected.
 * - Each entry must be a string; it is trimmed and lowercased, then
 *   checked against `a-z0-9-` (at least one character).
 * - Duplicate tags (after normalization) collapse to a single entry,
 *   since tags are a set of labels, not an ordered/counted list —
 *   mirroring the `tags @> ARRAY[...]` containment semantics already
 *   used for filtering (src/links/repository.ts).
 * - At most `MAX_TAGS` distinct tags are allowed.
 */
export function normalizeTags(rawTags: unknown): NormalizeTagsResult {
  if (!Array.isArray(rawTags)) {
    return { ok: false, error: "tags must be an array." };
  }

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const rawTag of rawTags) {
    if (typeof rawTag !== "string") {
      return { ok: false, error: "Each tag must be a string." };
    }

    const normalized = rawTag.trim().toLowerCase();
    if (normalized.length === 0) {
      return { ok: false, error: "Tags must not be blank." };
    }

    if (!TAG_PATTERN.test(normalized)) {
      return { ok: false, error: "Tags may only contain lowercase letters, numbers and hyphens." };
    }

    if (!seen.has(normalized)) {
      seen.add(normalized);
      tags.push(normalized);
    }
  }

  if (tags.length > MAX_TAGS) {
    return { ok: false, error: `A link may have at most ${MAX_TAGS} tags.` };
  }

  return { ok: true, tags };
}
