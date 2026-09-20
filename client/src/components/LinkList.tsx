import { useEffect, useRef, useState } from 'react'
import { useLinks } from '../hooks/useLinks'
import { TagList } from './TagList'
import { UndoToast } from './UndoToast'
import type { UndoToastItem } from './UndoToast'
import { deleteLink } from '../api/links'
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
  /**
   * Sent as `Authorization: Bearer <adminToken>` when a deletion is
   * committed (see `useAdminToken`/`AdminTokenField`). Deleting without one
   * — or with the wrong one — fails once the undo window closes; the link
   * reappears and an error explains why (see `commitDeletion`).
   */
  adminToken?: string
}

/** How long a deleted link stays undoable before the deletion is committed. */
const UNDO_WINDOW_MS = 5000

interface PendingDeletion {
  link: Link
  /** `Date.now()`-based deadline, used to derive the on-screen countdown. */
  expiresAt: number
  timeoutId: ReturnType<typeof setTimeout>
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

function displayNameOf(link: Link): string {
  return link.title || hostnameOf(link.url)
}

/**
 * Displays saved links newest-first, with each link's title, URL, creation
 * date and tags, plus cursor-based Previous/Next pagination.
 *
 * The API only hands back a `nextCursor` (no `previousCursor`), so this
 * component keeps its own stack of the cursors it has visited in order to
 * step backwards without re-requesting anything already seen.
 *
 * Deleting a link (LAR-34) is optimistic with a 5-second undo grace
 * period: clicking Delete hides the link immediately and starts a
 * countdown toast, but the `DELETE /api/links/:id` call itself is
 * deferred until the countdown finishes. Clicking Undo within that window
 * just cancels the pending call and un-hides the link — nothing ever hit
 * the server, so there's nothing to reconcile. There's no restore/undo
 * endpoint on the API, so deferring the call (rather than deleting
 * immediately and re-creating on undo) avoids a "restored" link coming
 * back with a new id/creation date, or being lost if re-creating it fails.
 */
export function LinkList({ tag, onItemsChange, adminToken }: LinkListProps) {
  // cursorStack[0] is always `undefined` (the first page). The last entry
  // is the cursor for the page currently on screen.
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([undefined])
  const cursor = cursorStack[cursorStack.length - 1]

  const { status, data, error } = useLinks(tag, cursor)

  const [pendingDeletions, setPendingDeletions] = useState<Map<string, PendingDeletion>>(
    new Map(),
  )
  // Ids the server has confirmed deleted. `data` (from `useLinks`) isn't
  // refetched just because a deletion committed, so without this the link
  // would reappear the moment it's no longer "pending" — this keeps it
  // hidden until the next real refetch (pagination, tag change, ...), at
  // which point the server won't return it anyway.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Ticks a re-render every 250ms while something is pending, purely so the
  // toast countdown updates; the value itself isn't read anywhere.
  const [, forceTick] = useState(0)

  const pendingRef = useRef(pendingDeletions)
  pendingRef.current = pendingDeletions

  // Never leave a deletion scheduled after this component (there's only
  // ever one instance, but tests mount/unmount it) goes away.
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((pending) => clearTimeout(pending.timeoutId))
    }
  }, [])

  useEffect(() => {
    if (pendingDeletions.size === 0) return
    const interval = setInterval(() => forceTick((t) => t + 1), 250)
    return () => clearInterval(interval)
  }, [pendingDeletions.size])

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

  function handleDelete(link: Link) {
    setDeleteError(null)
    const timeoutId = setTimeout(() => {
      void commitDeletion(link.id)
    }, UNDO_WINDOW_MS)

    setPendingDeletions((prev) => {
      const next = new Map(prev)
      next.set(link.id, { link, expiresAt: Date.now() + UNDO_WINDOW_MS, timeoutId })
      return next
    })
  }

  function handleUndo(id: string) {
    setPendingDeletions((prev) => {
      const pending = prev.get(id)
      if (!pending) return prev
      clearTimeout(pending.timeoutId)
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }

  async function commitDeletion(id: string) {
    const pending = pendingRef.current.get(id)

    try {
      await deleteLink(id, adminToken ?? '')
      setPendingDeletions((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      setDeletedIds((prev) => new Set(prev).add(id))
    } catch (cause) {
      // The delete never actually happened server-side — put the link
      // back rather than hiding it forever, and say why.
      setPendingDeletions((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      const reason = cause instanceof Error ? cause.message : 'Failed to delete link'
      const name = pending ? displayNameOf(pending.link) : 'link'
      setDeleteError(`Couldn't delete "${name}": ${reason}. It's back in your list.`)
    }
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

  const items = (data?.items ?? []).filter(
    (link) => !pendingDeletions.has(link.id) && !deletedIds.has(link.id),
  )

  const toastItems: UndoToastItem[] = Array.from(pendingDeletions.values()).map((pending) => ({
    id: pending.link.id,
    message: `Deleted "${displayNameOf(pending.link)}".`,
    secondsLeft: Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000)),
  }))

  return (
    <div className="link-list">
      {status === 'error' && (
        <p className="link-list__status link-list__status--error" role="alert">
          Couldn't load this page{error ? `: ${error.message}` : '.'} Showing the last page loaded.
        </p>
      )}

      {deleteError ? (
        <p className="link-list__delete-error" role="alert">
          {deleteError}
        </p>
      ) : null}

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
                  {displayNameOf(link)}
                </a>
                <span className="link-list__url">{hostnameOf(link.url)}</span>
              </div>

              <div className="link-list__meta">
                <time className="link-list__date" dateTime={link.createdAt}>
                  {formatDate(link.createdAt)}
                </time>
                <TagList tags={link.tags} label={`Tags for ${displayNameOf(link)}`} />
              </div>

              <div className="link-list__actions">
                <button
                  type="button"
                  className="link-list__delete"
                  onClick={() => handleDelete(link)}
                  disabled={!adminToken}
                  title={adminToken ? undefined : 'Set an admin token above to enable deleting links.'}
                  aria-label={`Delete ${displayNameOf(link)}`}
                >
                  Delete
                </button>
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

      <UndoToast items={toastItems} onUndo={handleUndo} />
    </div>
  )
}
