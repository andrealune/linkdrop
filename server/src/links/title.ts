/**
 * Page title fetching for saved links (LAR-23).
 *
 * `fetchPageTitle` tries to load the URL and read its `<title>` so callers
 * (e.g. the POST /api/links handler, LAR-24) can save a link without the
 * user having to type a title by hand. It never rejects: a timeout,
 * network error, non-2xx response or missing `<title>` all resolve to a
 * fallback result (the URL's hostname) rather than throwing, along with
 * an `error` describing what went wrong so the caller can decide whether
 * to surface it (e.g. to invite the user to enter a title manually).
 *
 * The one case that can't produce even a hostname fallback is an
 * unparsable/invalid URL — `source: "invalid"` signals that to the caller.
 * `fetchPageTitle` re-validates its input with `validateUrl` for this
 * reason, even when the caller already validated it.
 */
import { validateUrl } from "./url.js";

export const DEFAULT_TITLE_FETCH_TIMEOUT_MS = 3000;

/** Minimal shape of the global `fetch` this module relies on — kept narrow so a test double is trivial to write. */
export type FetchLike = (
  input: string,
  init?: { signal?: AbortSignal }
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface FetchTitleOptions {
  /** Milliseconds to wait for a response before giving up. Defaults to 3000 (LAR-23). */
  timeoutMs?: number;
  /** Injectable in tests; defaults to the global `fetch`. */
  fetchImpl?: FetchLike;
}

export interface TitleFetchResult {
  /** The page's title, or the URL's hostname when it couldn't be determined, or "" when the URL itself is invalid. */
  title: string;
  /**
   * "fetched" — read from the page's `<title>`.
   * "fallback" — the URL was valid but the title couldn't be fetched or found; `title` is the hostname.
   * "invalid" — `url` failed validation; there is no title or hostname to fall back to.
   */
  source: "fetched" | "fallback" | "invalid";
  /** Present when `source` is not "fetched": why, safe to show the client. */
  error?: string;
}

const TITLE_TAG_PATTERN = /<title[^>]*>([^<]*)<\/title>/i;

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#34;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " "
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&(amp|lt|gt|quot|apos|#34|#39|nbsp);/g, (entity) => HTML_ENTITIES[entity] ?? entity)
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function extractTitle(html: string): string {
  const match = TITLE_TAG_PATTERN.exec(html);
  if (!match) return "";
  return decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim();
}

export async function fetchPageTitle(
  rawUrl: unknown,
  options: FetchTitleOptions = {}
): Promise<TitleFetchResult> {
  const { timeoutMs = DEFAULT_TITLE_FETCH_TIMEOUT_MS, fetchImpl = fetch as unknown as FetchLike } = options;

  const validation = validateUrl(rawUrl);
  if (!validation.valid || !validation.url) {
    return { title: "", source: "invalid", error: validation.error ?? "URL is not valid." };
  }
  const { url } = validation;
  const hostname = url.hostname;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url.toString(), { signal: controller.signal });

    if (!response.ok) {
      return {
        title: hostname,
        source: "fallback",
        error: `Request failed with status ${response.status}.`
      };
    }

    const html = await response.text();
    const title = extractTitle(html);

    if (!title) {
      return { title: hostname, source: "fallback", error: "Page has no title." };
    }

    return { title, source: "fetched" };
  } catch (err) {
    const timedOut = controller.signal.aborted;
    const message = timedOut
      ? `Timed out after ${timeoutMs}ms.`
      : err instanceof Error
        ? err.message
        : "Unknown error while fetching the page.";
    return { title: hostname, source: "fallback", error: message };
  } finally {
    clearTimeout(timer);
  }
}
