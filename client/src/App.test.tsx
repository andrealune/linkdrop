import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    // Avoid a real network call to the API during this smoke test. Both the
    // health check and the link list hit this same mock and will "fail".
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network disabled in tests')),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the app title and configured API URL', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Linkdrop' })).toBeInTheDocument()
    expect(screen.getByText(/API URL/)).toBeInTheDocument()

    // Let the health-check and link-list effects settle so React doesn't
    // warn about an update happening after the test has finished asserting.
    await waitFor(() => expect(screen.getByText('API unreachable')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
