import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request } from './client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('request', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('resolves with the parsed JSON body on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ hello: 'world' })))

    await expect(request('/api/things')).resolves.toEqual({ hello: 'world' })
  })

  it('sends method, JSON body and merged headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await request('/api/things', {
      method: 'POST',
      body: { a: 1 },
      headers: { 'X-Test': 'yes' },
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/things')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ a: 1 }))
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Test': 'yes',
    })
  })

  it('sends an Authorization header when a token is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await request('/api/things', { token: 'secret' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers).toMatchObject({ Authorization: 'Bearer secret' })
  })

  it('resolves with undefined for a 204 No Content response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    await expect(request('/api/things')).resolves.toBeUndefined()
  })

  it('rejects with an ApiError carrying the status and a JSON error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Link not found' }), {
          status: 404,
          statusText: 'Not Found',
        }),
      ),
    )

    const error = await request<never>('/api/things').catch((e) => e as ApiError)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(error.message).toBe('Link not found')
  })

  it('falls back to the status text when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 500, statusText: 'Server Error' })),
    )

    const error = await request<never>('/api/things').catch((e) => e as ApiError)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(500)
    expect(error.message).toBe('Server Error')
  })

  it('rejects with an ApiError with status 0 on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const error = await request<never>('/api/things').catch((e) => e as ApiError)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.message).toBe('Failed to fetch')
  })
})
