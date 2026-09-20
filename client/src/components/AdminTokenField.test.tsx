import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { AdminTokenField } from './AdminTokenField'

describe('AdminTokenField', () => {
  it('renders the current value', () => {
    render(<AdminTokenField value="secret-token" onChange={vi.fn()} />)

    expect(screen.getByLabelText('Admin token')).toHaveValue('secret-token')
  })

  it('is a password field, masking the token', () => {
    render(<AdminTokenField value="secret-token" onChange={vi.fn()} />)

    expect(screen.getByLabelText('Admin token')).toHaveAttribute('type', 'password')
  })

  it('calls onChange with the new value as the user types', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<AdminTokenField value="" onChange={onChange} />)

    await user.type(screen.getByLabelText('Admin token'), 'abc')

    expect(onChange).toHaveBeenCalledTimes(3)
    expect(onChange).toHaveBeenLastCalledWith('c')
  })

  it('describes the field with a hint', () => {
    render(<AdminTokenField value="" onChange={vi.fn()} />)

    const input = screen.getByLabelText('Admin token')
    const hintId = input.getAttribute('aria-describedby')
    expect(hintId).toBeTruthy()
    expect(document.getElementById(hintId as string)).toHaveTextContent(/kept only in this browser tab/i)
  })
})
