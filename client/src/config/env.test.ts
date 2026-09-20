import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// import.meta.env types are readonly for app code; tests intentionally
// mutate them to exercise both branches of env.ts.
const env = import.meta.env as unknown as Record<string, string>

describe('env.apiUrl', () => {
  const originalUrl = env.VITE_API_URL

  beforeEach(() => {
    vi.resetModules()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    env.VITE_API_URL = originalUrl
    vi.restoreAllMocks()
  })

  it('uses VITE_API_URL when it is set', async () => {
    env.VITE_API_URL = 'https://api.example.com/'
    const { env: appEnv } = await import('./env')
    expect(appEnv.apiUrl).toBe('https://api.example.com')
  })

  it('falls back to localhost and warns when VITE_API_URL is missing', async () => {
    env.VITE_API_URL = ''
    const { env: appEnv } = await import('./env')
    expect(appEnv.apiUrl).toBe('http://localhost:3001')
    expect(console.warn).toHaveBeenCalled()
  })
})
