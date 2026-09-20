/**
 * Business logic for replacing a link's tags (LAR-27:
 * `POST /api/links/:id/tags`).
 *
 * Kept separate from the HTTP layer (src/app.ts) and the UPDATE SQL
 * (src/links/repository.ts), mirroring the deleteLink.ts / createLink.ts
 * pattern used elsewhere in this module. Authentication (the
 * LINKDROP_ADMIN_TOKEN check) happens earlier, in the `requireAdminToken`
 * middleware (src/auth.ts) — this module only validates and normalizes
 * `id`/`tags` and decides whether a matching link exists to update.
 */
import { updateLinkTags as replaceTagsById, type LinkRecord } from "./repository.js";

/** A link may have at most this many tags (LAR-27). */
export const MAX_TAGS = 5;

/** Tags are stored lowercase and may only contain letters, digits and hyphens. */
const TAG_PATTERN = /^[a-z0-9-]+$/;

export interface UpdateLinkTagsInput {
  tags?: unknown;
}

export interface UpdateLinkTagsDeps {
  /** Injectable for tests; defaults to the real `updateLinkTags` repository call. */
  replace?: (id: string, tags: string[]) => Promise<LinkRecord | null>;
}

export interface UpdateLinkTagsSuccess {
  ok: true;
  link: LinkRecord;
}

export interface UpdateLinkTagsFailure {
  ok: false;
  /** HTTP status the caller should respond with. */
  status: number;
  /** Human-readable, client-safe error message. */
  error: string;
}

export type UpdateLinkTagsResult = UpdateLinkTagsSuccess | UpdateLinkTagsFailure;

function invalid(error: string): UpdateLinkTagsFailure {
  return { ok: false, status: 400, error };
}

/**
 * `id` comes straight from the URL path (`req.params.id`), so it is
 * always a string; the `links.id` column is BIGSERIAL, i.e. a positive
 * integer that fits a Postgres `bigint`. Reject anything else before it
 * reaches the database rather than let an invalid cast fail as a 500
 * (mirrors src/links/deleteLink.ts).
 */
function isWellFormedId(id: string): boolean {
  return /^[1-9][0-9]*$/.test(id);
}

/**
 * Validates and normalizes the `tags` input.
 *
 * - Must be an array; anything else is rejected.
 * - Each entry must be a string; it is trimmed and lowercased, then
 *   checked against `TAG_PATTERN` (`a-z0-9-`, at least one character).
 * - Duplicate tags (after normalization) collapse to a single entry,
 *   since `tags` is a set of labels, not an ordered/counted list —
 *   mirroring the `tags @> ARRAY[...]` containment semantics already
 *   used for filtering (src/links/repository.ts).
 * - At most `MAX_TAGS` distinct tags are allowed.
 */
function validateTags(rawTags: unknown): { ok: true; tags: string[] } | { ok: false; error: string } {
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

export async function updateLinkTags(
  id: string,
  input: UpdateLinkTagsInput,
  deps: UpdateLinkTagsDeps = {}
): Promise<UpdateLinkTagsResult> {
  const { replace = replaceTagsById } = deps;

  if (!isWellFormedId(id)) {
    return invalid("id must be a positive integer.");
  }

  const tagsValidation = validateTags(input.tags);
  if (!tagsValidation.ok) {
    return invalid(tagsValidation.error);
  }

  try {
    const link = await replace(id, tagsValidation.tags);
    if (!link) {
      return { ok: false, status: 404, error: "Link not found." };
    }
    return { ok: true, link };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "Failed to update tags."
    };
  }
}
