import { useEffect, useState } from 'react'
import { listLinks } from '../api/links'
import type { ListLinksResult } from '../api/links'

export type LinksStatus = 'loading' | 'success' | 'error'

export interface UseLinksResult {
  /**
   * `loading` while a request for the current `tag`/`cursor` is in flight,
   * `success` once it resolves and `error` if it rejects. `data` holds the
   * most recently *successful* page, so a failed refetch (e.g. going to the
   * next page while offline) doesn't blank out the list that's on screen.
   */
  status: LinksStatus
  data: ListLinksResult | null
  error: Error | null
}

/**
 * Fetches one page of links for the given tag filter and cursor, re-fetching
 * whenever either changes. Callers own pagination state (which cursor is
 * "current") — this hook only knows how to fetch a single page.
 */
export function useLinks(tag: string | undefined, cursor: string | undefined): UseLinksResult {
  const [status, setStatus] = useState<LinksStatus>('loading')
  const [data, setData] = useState<ListLinksResult | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setError(null)

    listLinks({ tag, cursor })
      .then((result) => {
        if (cancelled) return
        setData(result)
        setStatus('success')
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause : new Error('Failed to load links'))
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [tag, cursor])

  return { status, data, error }
}
