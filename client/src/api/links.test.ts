import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLink, deleteLink, listLinks, replaceTags } from './links'
import type { Link } from './links'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sampleLink: Link = {
  id: '1',
  url: 'https://example.com',
  title: 'Example',
  tags: ['news'],
  createdAt: '2024-01-01T00:00:00.000Z',
}

describe('createLink', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('POSTs to /api/links with the given url and title and returns the created link', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(sampleLink))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createLink({ url: 'https://example.com', title: 'Example' })

    expect(result).toEqual(sampleLink)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/links')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ url: 'https://example.com', title: 'Example' }))
    expect(init.headers).not.toHaveProperty('Authorization')
  })

  it('omits title when not provided, letting the server derive one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(sampleLink))
    vi.stubGlobal('fetch', fetchMock)

    await createLink({ url: 'https://example.com' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBe(JSON.stringify({ url: 'https://example.com' }))
  })

  it('rejects with the parsed error message on validation failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'Invalid URL' }, 400))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createLink({ url: 'not-a-url' })).rejects.toMatchObject({
      message: 'Invalid URL',
      status: 400,
    })
  })
})

describe('listLinks', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('GETs /api/links with no query string when called with no params', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [sampleLink], nextCursor: null }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listLinks()

    expect(result).toEqual({ items: [sampleLink], nextCursor: null })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/links$/)
    expect(init.method).toBeUndefined()
  })

  it('includes tag and cursor as query parameters when provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [], nextCursor: 'abc' }))
    vi.stubGlobal('fetch', fetchMock)

    await listLinks({ tag: 'news', cursor: 'xyz' })

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('tag=news')
    expect(url).toContain('cursor=xyz')
  })
})

describe('deleteLink', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('DELETEs /api/links/:id with the admin token and resolves with undefined', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteLink('42', 'secret-token')).resolves.toBeUndefined()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/links\/42$/)
    expect(init.method).toBe('DELETE')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer secret-token' })
  })

  it('URL-encodes the id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await deleteLink('a/b c', 'secret-token')

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain(encodeURIComponent('a/b c'))
  })

  it('rejects with ApiError with status 401 when the token is missing or wrong', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401))
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteLink('42', 'wrong')).rejects.toMatchObject({
      message: 'Unauthorized',
      status: 401,
    })
  })
})

describe('replaceTags', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('POSTs to /api/links/:id/tags with the tags and admin token, returning the updated link', async () => {
    const updated = { ...sampleLink, tags: ['a', 'b'] }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(updated))
    vi.stubGlobal('fetch', fetchMock)

    const result = await replaceTags('1', ['a', 'b'], 'secret-token')

    expect(result).toEqual(updated)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/links\/1\/tags$/)
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ tags: ['a', 'b'] }))
    expect(init.headers).toMatchObject({ Authorization: 'Bearer secret-token' })
  })

  it('rejects with the parsed error message when tags are invalid', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'At most 5 tags allowed' }, 422))
    vi.stubGlobal('fetch', fetchMock)

    await expect(replaceTags('1', ['a', 'b', 'c', 'd', 'e', 'f'], 'secret-token')).rejects.toMatchObject(
      { message: 'At most 5 tags allowed', status: 422 },
    )
  })
})
