import { useId } from 'react'
import './AdminTokenField.css'

export interface AdminTokenFieldProps {
  value: string
  onChange: (token: string) => void
}

/**
 * Lets whoever is running this (single-operator) instance paste in their
 * `LINKDROP_ADMIN_TOKEN` so the client can authenticate destructive calls —
 * currently just deleting a link (see `LinkList`).
 *
 * The token is held by `useAdminToken` (sessionStorage, this tab only) and
 * passed down as a controlled value, the same pattern as every other form
 * field in the app.
 */
export function AdminTokenField({ value, onChange }: AdminTokenFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`

  return (
    <div className="admin-token-field">
      <label htmlFor={id}>Admin token</label>
      <input
        id={id}
        name="adminToken"
        type="password"
        autoComplete="off"
        placeholder="Paste your LINKDROP_ADMIN_TOKEN to enable delete"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hintId}
      />
      <p id={hintId} className="admin-token-field__hint">
        Needed to delete links. Kept only in this browser tab — never saved to the build.
      </p>
    </div>
  )
}
