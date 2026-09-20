import { env } from '../config/env'

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

/**
 * Thin JSON fetch wrapper for talking to the Linkdrop API.
 *
 * Every call is resolved against `VITE_API_URL` (see `src/config/env.ts`),
 * so callers only need to pass the path, e.g. `request('/api/links')`.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers, ...rest } = options

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new ApiError(text || response.statusText, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
