/**
 * Business logic for replacing a link's tags (LAR-27:
 * `POST /api/links/:id/tags`).
 *
 * Kept separate from the HTTP layer (src/app.ts) and the UPDATE SQL
 * (src/links/repository.ts), mirroring the deleteLink.ts / createLink.ts
 * pattern used elsewhere in this module. Authentication (the
 * LINKDROP_ADMIN_TOKEN check) happens earlier, in the `requireAdminToken`
 * middleware (src/auth.ts) — this module only validates/normalizes
 * `id`/`tags` and decides whether a matching link exists to update.
 *
 * The actual tag normalization rules (lowercase, `a-z0-9-` only, at most
 * `MAX_TAGS` entries) live in `./tags.js` (LAR-28), so they can be reused
 * and unit tested independently of this HTTP-facing module.
 */
import { updateLinkTags as replaceTagsById, type LinkRecord } from "./repository.js";
import { normalizeTags, MAX_TAGS } from "./tags.js";

export { MAX_TAGS };

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

export async function updateLinkTags(
  id: string,
  input: UpdateLinkTagsInput,
  deps: UpdateLinkTagsDeps = {}
): Promise<UpdateLinkTagsResult> {
  const { replace = replaceTagsById } = deps;

  if (!isWellFormedId(id)) {
    return invalid("id must be a positive integer.");
  }

  const tagsValidation = normalizeTags(input.tags);
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
