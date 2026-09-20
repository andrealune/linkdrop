import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLinks } from './useLinks'
import type { Link } from '../api/links'

vi.mock('../api/links', () => ({
  listLinks: vi.fn(),
}))

import { listLinks } from '../api/links'

const sampleLink: Link = {
  id: '1',
  url: 'https://example.com',
  title: 'Example',
  tags: ['news'],
  createdAt: '2024-01-01T00:00:00.000Z',
}

describe('useLinks', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('starts in the loading state with no data', () => {
    vi.mocked(listLinks).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useLinks(undefined, undefined))

    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches with the given tag and cursor and stores the result on success', async () => {
    const page = { items: [sampleLink], nextCursor: 'abc' }
    vi.mocked(listLinks).mockResolvedValue(page)

    const { result } = renderHook(() => useLinks('news', 'xyz'))

    await waitFor(() => expect(result.current.status).toBe('success'))

    expect(result.current.data).toEqual(page)
    expect(result.current.error).toBeNull()
    expect(listLinks).toHaveBeenCalledWith({ tag: 'news', cursor: 'xyz' })
  })

  it('exposes the error and keeps data null when the request fails', async () => {
    vi.mocked(listLinks).mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useLinks(undefined, undefined))

    await waitFor(() => expect(result.current.status).toBe('error'))

    expect(result.current.data).toBeNull()
    expect(result.current.error).toMatchObject({ message: 'boom' })
  })

  it('refetches when the cursor changes', async () => {
    const firstPage = { items: [sampleLink], nextCursor: 'page2' }
    const secondPage = { items: [{ ...sampleLink, id: '2' }], nextCursor: null }
    vi.mocked(listLinks).mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage)

    const { result, rerender } = renderHook(({ cursor }) => useLinks(undefined, cursor), {
      initialProps: { cursor: undefined as string | undefined },
    })

    await waitFor(() => expect(result.current.data).toEqual(firstPage))

    rerender({ cursor: 'page2' })

    await waitFor(() => expect(result.current.data).toEqual(secondPage))
    expect(listLinks).toHaveBeenNthCalledWith(2, { tag: undefined, cursor: 'page2' })
  })
})
