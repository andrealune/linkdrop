/**
 * Business logic for deleting a link (LAR-26).
 *
 * Kept separate from the HTTP layer (src/app.ts) and the id validation
 * from the actual DELETE (src/links/repository.ts), mirroring the
 * createLink.ts / listLinks.ts pattern used elsewhere in this module.
 * Authentication (the LINKDROP_ADMIN_TOKEN check) happens earlier, in
 * the `requireAdminToken` middleware (src/auth.ts) — this module only
 * decides whether the *id* is well-formed and whether a matching link
 * exists to delete.
 */
import { deleteLinkById as removeLink } from "./repository.js";

export interface DeleteLinkDeps {
  /** Injectable for tests; defaults to the real `deleteLinkById`. */
  remove?: (id: string) => Promise<boolean>;
}

export interface DeleteLinkSuccess {
  ok: true;
}

export interface DeleteLinkFailure {
  ok: false;
  /** HTTP status the caller should respond with. */
  status: number;
  /** Human-readable, client-safe error message. */
  error: string;
}

export type DeleteLinkResult = DeleteLinkSuccess | DeleteLinkFailure;

function invalid(error: string): DeleteLinkFailure {
  return { ok: false, status: 400, error };
}

/**
 * `id` comes straight from the URL path (`req.params.id`), so it is
 * always a string; the `links.id` column is BIGSERIAL, i.e. a positive
 * integer that fits a Postgres `bigint`. Reject anything else before it
 * reaches the database rather than let an invalid cast fail as a 500.
 */
function isWellFormedId(id: string): boolean {
  return /^[1-9][0-9]*$/.test(id);
}

export async function deleteLink(id: string, deps: DeleteLinkDeps = {}): Promise<DeleteLinkResult> {
  const { remove = removeLink } = deps;

  if (!isWellFormedId(id)) {
    return invalid("id must be a positive integer.");
  }

  try {
    const deleted = await remove(id);
    if (!deleted) {
      return { ok: false, status: 404, error: "Link not found." };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "Failed to delete link."
    };
  }
}
