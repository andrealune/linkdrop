import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useAdminToken } from './useAdminToken'

const STORAGE_KEY = 'linkdrop.adminToken'

describe('useAdminToken', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('starts empty when nothing is stored', () => {
    const { result } = renderHook(() => useAdminToken())

    expect(result.current[0]).toBe('')
  })

  it('reads a previously stored token on mount', () => {
    sessionStorage.setItem(STORAGE_KEY, 'existing-token')

    const { result } = renderHook(() => useAdminToken())

    expect(result.current[0]).toBe('existing-token')
  })

  it('updates state and persists to sessionStorage when set', () => {
    const { result } = renderHook(() => useAdminToken())

    act(() => {
      result.current[1]('secret-token')
    })

    expect(result.current[0]).toBe('secret-token')
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('secret-token')
  })

  it('removes the stored token when set back to an empty string', () => {
    const { result } = renderHook(() => useAdminToken())

    act(() => {
      result.current[1]('secret-token')
    })
    act(() => {
      result.current[1]('')
    })

    expect(result.current[0]).toBe('')
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
