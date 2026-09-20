import type { ReactNode } from 'react'
import './StatusBadge.css'

export type StatusBadgeState = 'loading' | 'online' | 'offline'

const LABEL: Record<StatusBadgeState, ReactNode> = {
  loading: 'Checking API…',
  online: 'API connected',
  offline: 'API unreachable',
}

/**
 * Small, accessible status indicator. Colour is never the only signal:
 * the state is also conveyed by text and by `role="status"` so screen
 * readers announce updates.
 */
export function StatusBadge({ state }: { state: StatusBadgeState }) {
  return (
    <span className={`status-badge status-badge--${state}`} role="status">
      <span aria-hidden="true" className="status-badge__dot" />
      {LABEL[state]}
    </span>
  )
}
