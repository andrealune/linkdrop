import { env } from '../config/env'

/**
 * Thrown for any non-2xx response from the API.
 *
 * `status` is the HTTP status code. `message` is, when the server responded
 * with a JSON body containing an `error` or `message` string field, that
 * value; otherwise it falls back to the raw response body, then to the
 * HTTP status text.
 */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** Auth token sent as `Authorization: Bearer <token>` when provided. */
  token?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Extracts a human-readable message from an error response body. */
function extractErrorMessage(text: string, fallback: string): string {
  if (!text) return fallback

  try {
    const parsed: unknown = JSON.parse(text)
    if (isRecord(parsed)) {
      const candidate = parsed.error ?? parsed.message
      if (typeof candidate === 'string' && candidate.length > 0) {
        return candidate
      }
    }
  } catch {
    // Not JSON — fall through to using the raw text.
  }

  return text || fallback
}

/**
 * Thin JSON fetch wrapper for talking to the Linkdrop API.
 *
 * Every call is resolved against `VITE_API_URL` (see `src/config/env.ts`),
 * so callers only need to pass the path, e.g. `request('/api/links')`.
 *
 * Non-2xx responses reject with `ApiError`. A `204 No Content` response
 * resolves with `undefined`.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers, ...rest } = options

  let response: Response
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (cause) {
    // Network failure (offline, DNS, CORS, server unreachable, etc.) — no
    // HTTP status is available, so use 0 to distinguish it from a server
    // response.
    const message = cause instanceof Error ? cause.message : 'Network request failed'
    throw new ApiError(message, 0)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new ApiError(extractErrorMessage(text, response.statusText), response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  if (!text) {
    return undefined as T
  }

  return JSON.parse(text) as T
}
