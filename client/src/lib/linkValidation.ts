/**
 * Client-side validation for the add-link form.
 *
 * Mirrors the constraints the server enforces (see server validation for
 * `POST /api/links`) closely enough to give the user instant feedback, but
 * the server remains the source of truth — a server-side rejection (returned
 * as `ApiError`) is still surfaced by the form even when these checks pass.
 */

/** Matches the server's practical limit for a stored URL. */
export const URL_MAX_LENGTH = 2048

/** Matches the server's practical limit for a stored title. */
export const TITLE_MAX_LENGTH = 200

/**
 * Validates a URL value from the form.
 *
 * Returns an error message to display, or `undefined` when the value is
 * valid. Only `http`/`https` URLs are accepted — that is what the server
 * fetches a title for and what makes sense to "save" as a link.
 */
export function validateUrl(value: string): string | undefined {
  const trimmed = value.trim()

  if (!trimmed) {
    return 'Enter a URL.'
  }

  if (trimmed.length > URL_MAX_LENGTH) {
    return `URL must be ${URL_MAX_LENGTH} characters or fewer.`
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return 'Enter a valid URL, including https://'
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'URL must start with http:// or https://'
  }

  return undefined
}

/**
 * Validates the optional title value from the form.
 *
 * An empty title is valid — the server fetches one from the page when it is
 * omitted. Returns an error message to display, or `undefined` when valid.
 */
export function validateTitle(value: string): string | undefined {
  if (value.length > TITLE_MAX_LENGTH) {
    return `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`
  }

  return undefined
}
