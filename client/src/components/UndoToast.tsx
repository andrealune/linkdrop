import './UndoToast.css'

export interface UndoToastItem {
  /** The deleted link's id — identifies which pending deletion this is. */
  id: string
  /** Static message, e.g. `Deleted "My Article".` — announced once. */
  message: string
  /** Seconds left before the deletion is committed; display only. */
  secondsLeft: number
}

export interface UndoToastProps {
  items: UndoToastItem[]
  onUndo: (id: string) => void
}

/**
 * Stack of "Deleted X — Undo" toasts, one per link currently in its
 * undo grace period (see `LinkList`).
 *
 * Each toast is its own `role="status"` region so a screen reader
 * announces it once, when it appears. The ticking countdown is
 * `aria-hidden` — it's a visual convenience, not something worth
 * re-announcing every second.
 */
export function UndoToast({ items, onUndo }: UndoToastProps) {
  if (items.length === 0) return null

  return (
    <div className="undo-toast__region">
      <ul className="undo-toast__list">
        {items.map((item) => (
          <li key={item.id} className="undo-toast__item" role="status">
            <span className="undo-toast__message">{item.message}</span>
            <span className="undo-toast__countdown" aria-hidden="true">
              {item.secondsLeft}s
            </span>
            <button
              type="button"
              className="undo-toast__button"
              onClick={() => onUndo(item.id)}
            >
              Undo
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
