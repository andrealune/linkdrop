import { request } from './client'

/**
 * A saved link, as returned by the API.
 *
 * `tags` is always present (empty array when the link has none) and always
 * normalised by the server: lowercase, `a-z0-9-`, at most 5 entries.
 */
export interface Link {
  id: string
  url: string
  title: string
  tags: string[]
  /** ISO 8601 timestamp. */
  createdAt: string
}

/** Body for `POST /api/links`. */
export interface CreateLinkInput {
  url: string
  /** Omit to have the server fetch the page title (falls back to hostname). */
  title?: string
}

export interface ListLinksParams {
  /** Only return links tagged with this value. */
  tag?: string
  /** Opaque cursor from a previous `ListLinksResult.nextCursor`. */
  cursor?: string
}

/** Response for `GET /api/links`: newest-first, 50 per page. */
export interface ListLinksResult {
  items: Link[]
  /** Pass to `cursor` on the next call to fetch the following page; `null` on the last page. */
  nextCursor: string | null
}

/** Body for `POST /api/links/:id/tags`. Replaces the link's tag set. */
export interface ReplaceTagsInput {
  /** Max 5, lowercase, `a-z0-9-`. Validated server-side. */
  tags: string[]
}

/** Calls `POST /api/links` to save a new link. Does not require an admin token. */
export function createLink(input: CreateLinkInput): Promise<Link> {
  return request<Link>('/api/links', {
    method: 'POST',
    body: input,
  })
}

/** Calls `GET /api/links` to list saved links, newest first. Does not require an admin token. */
export function listLinks(params: ListLinksParams = {}): Promise<ListLinksResult> {
  const query = new URLSearchParams()
  if (params.tag) query.set('tag', params.tag)
  if (params.cursor) query.set('cursor', params.cursor)

  const queryString = query.toString()
  const path = queryString ? `/api/links?${queryString}` : '/api/links'

  return request<ListLinksResult>(path)
}

/**
 * Calls `DELETE /api/links/:id` to remove a link.
 *
 * Requires the admin token (sent as `Authorization: Bearer <token>`).
 */
export function deleteLink(id: string, token: string): Promise<void> {
  return request<void>(`/api/links/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  })
}

/**
 * Calls `POST /api/links/:id/tags` to replace a link's tags.
 *
 * Requires the admin token (sent as `Authorization: Bearer <token>`).
 */
export function replaceTags(id: string, tags: string[], token: string): Promise<Link> {
  return request<Link>(`/api/links/${encodeURIComponent(id)}/tags`, {
    method: 'POST',
    body: { tags } satisfies ReplaceTagsInput,
    token,
  })
}
