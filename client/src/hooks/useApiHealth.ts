import { useEffect, useState } from 'react'
import { getHealth } from '../api/health'

type Status = 'loading' | 'online' | 'offline'

/**
 * Pings the API's /api/health endpoint so the app has a quick, visible
 * signal that VITE_API_URL is configured correctly and the server is
 * reachable. Not a feature in its own right — later tasks (link list, add
 * form, etc.) will replace the landing page this renders on.
 */
export function useApiHealth() {
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let cancelled = false

    getHealth()
      .then(() => {
        if (!cancelled) setStatus('online')
      })
      .catch(() => {
        if (!cancelled) setStatus('offline')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return status
}
