import { useCallback, useState } from 'react'

const STORAGE_KEY = 'linkdrop.adminToken'

function readStoredToken(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    // sessionStorage can throw (privacy mode, disabled storage, ...) — fall
    // back to "no token" rather than crashing the app over it.
    return ''
  }
}

function writeStoredToken(token: string): void {
  try {
    if (token) {
      sessionStorage.setItem(STORAGE_KEY, token)
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Same as above: the in-memory value still works for this render, it
    // just won't survive a reload.
  }
}

/**
 * Holds the admin token used to authenticate destructive/tag-editing API
 * calls (delete a link, replace tags — see `server/src/auth.ts` and
 * `requireAdminToken`).
 *
 * Linkdrop has no login flow: it's a single-operator tool, so whoever runs
 * it pastes their own `LINKDROP_ADMIN_TOKEN` in once (see
 * `AdminTokenField`). The token is kept in `sessionStorage` only — cleared
 * when the tab closes, never sent anywhere but the `Authorization` header
 * of admin requests, and never baked into the build (unlike `VITE_*`
 * variables, it doesn't ship in the JS bundle for every visitor).
 */
export function useAdminToken(): [string, (token: string) => void] {
  const [token, setTokenState] = useState<string>(readStoredToken)

  const setToken = useCallback((next: string) => {
    setTokenState(next)
    writeStoredToken(next)
  }, [])

  return [token, setToken]
}
