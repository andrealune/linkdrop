import { useEffect, useState } from 'react'
import { useLinks } from '../hooks/useLinks'
import { TagList } from './TagList'
import type { Link } from '../api/links'
import './LinkList.css'

export interface LinkListProps {
  /** Only show links tagged with this value. When it changes, pagination resets to page 1. */
  tag?: string
  /**
   * Called whenever the page of links on screen changes (a new page loads
   * successfully, including the first one). Receives exactly the items
   * being rendered — useful for deriving "tags seen on the current page"
   * for a tag filter without this component needing to know about one.
   */
  onItemsChange?: (items: Link[]) => void
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return dateFormatter.format(date)
}

/** Shortens a URL to its host for display; falls back to the raw string if it doesn't parse. */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * Displays saved links newest-first, with each link's title, URL, creation
 * date and tags, plus cursor-based Previous/Next pagination.
 *
 * The API only hands back a `nextCursor` (no `previousCursor`), so this
 * component keeps its own stack of the cursors it has visited in order to
 * step backwards without re-requesting anything already seen.
 */
export function LinkList({ tag, onItemsChange }: LinkListProps) {
  // cursorStack[0] is always `undefined` (the first page). The last entry
  // is the cursor for the page currently on screen.
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([undefined])
  const cursor = cursorStack[cursorStack.length - 1]

  const { status, data, error } = useLinks(tag, cursor)

  // Reset to page 1 whenever the tag filter changes.
  useEffect(() => {
    setCursorStack([undefined])
  }, [tag])

  // Let callers (e.g. a tag filter) know what's actually on screen whenever
  // a page finishes loading successfully.
  useEffect(() => {
    if (data) {
      onItemsChange?.(data.items)
    }
  }, [data, onItemsChange])

  const page = cursorStack.length
  const hasPrevious = cursorStack.length > 1
  const hasNext = Boolean(data?.nextCursor)
  const isRefetching = status === 'loading' && data !== null

  function goToNext() {
    const nextCursor = data?.nextCursor
    if (!nextCursor) return
    setCursorStack((stack) => [...stack, nextCursor])
  }

  function goToPrevious() {
    setCursorStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack))
  }

  // Initial load: nothing on screen yet.
  if (status === 'loading' && data === null) {
    return (
      <div className="link-list">
        <p className="link-list__status" role="status">
          Loading links…
        </p>
      </div>
    )
  }

  // Initial load failed: nothing to show but the error.
  if (status === 'error' && data === null) {
    return (
      <div className="link-list">
        <p className="link-list__status link-list__status--error" role="alert">
          Couldn't load links{error ? `: ${error.message}` : '.'}
        </p>
      </div>
    )
  }

  const items = data?.items ?? []

  return (
    <div className="link-list">
      {status === 'error' && (
        <p className="link-list__status link-list__status--error" role="alert">
          Couldn't load this page{error ? `: ${error.message}` : '.'} Showing the last page loaded.
        </p>
      )}

      {items.length === 0 ? (
        <p className="link-list__status">No links yet.</p>
      ) : (
        <ul className="link-list__items">
          {items.map((link) => (
            <li key={link.id} className="link-list__item">
              <div className="link-list__main">
                <a
                  className="link-list__title"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.title || hostnameOf(link.url)}
                </a>
                <span className="link-list__url">{hostnameOf(link.url)}</span>
              </div>

              <div className="link-list__meta">
                <time className="link-list__date" dateTime={link.createdAt}>
                  {formatDate(link.createdAt)}
                </time>
                <TagList tags={link.tags} label={`Tags for ${link.title || link.url}`} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <nav className="link-list__pagination" aria-label="Link list pagination">
        <button type="button" onClick={goToPrevious} disabled={!hasPrevious || isRefetching}>
          Previous
        </button>
        <span className="link-list__page" role="status" aria-live="polite">
          {isRefetching ? 'Loading…' : `Page ${page}`}
        </span>
        <button type="button" onClick={goToNext} disabled={!hasNext || isRefetching}>
          Next
        </button>
      </nav>
    </div>
  )
}
