/**
 * URL validation for saved links (LAR-23).
 *
 * A link's URL is stored as free-form TEXT (see
 * migrations/0001_create_links_table.sql) but must still be a well-formed,
 * fetchable web address before it's accepted:
 *  - required, non-blank
 *  - at most 2048 characters (a conservative, widely-used ceiling for URL
 *    length; long enough for real-world links, short enough to keep the
 *    column and any downstream HTTP client sane)
 *  - parses as an absolute URL
 *  - uses the http or https scheme (anything else — javascript:, ftp:,
 *    mailto:, ... — can't be "opened" as a saved link and is rejected)
 */

export const MAX_URL_LENGTH = 2048;

export interface UrlValidationResult {
  /** Whether `input` is an acceptable link URL. */
  valid: boolean;
  /** Present when `valid` is false: a human-readable reason, safe to show the client. */
  error?: string;
  /**
   * Present when `valid` is true: the parsed URL, trimmed of surrounding
   * whitespace. Callers (e.g. fetchPageTitle) can use `.hostname`,
   * `.toString()`, etc. without re-parsing.
   */
  url?: URL;
}

function invalid(error: string): UrlValidationResult {
  return { valid: false, error };
}

export function validateUrl(input: unknown): UrlValidationResult {
  if (typeof input !== "string") {
    return invalid("URL is required.");
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return invalid("URL is required.");
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    return invalid(`URL must be ${MAX_URL_LENGTH} characters or fewer.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return invalid("URL is not valid.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return invalid("URL must start with http:// or https://.");
  }

  return { valid: true, url: parsed };
}
