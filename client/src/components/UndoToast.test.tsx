import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UndoToast } from './UndoToast'

describe('UndoToast', () => {
  it('renders nothing when there are no pending deletions', () => {
    const { container } = render(<UndoToast items={[]} onUndo={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the message and countdown for each pending deletion', () => {
    render(
      <UndoToast
        items={[
          { id: '1', message: 'Deleted "First".', secondsLeft: 5 },
          { id: '2', message: 'Deleted "Second".', secondsLeft: 3 },
        ]}
        onUndo={vi.fn()}
      />,
    )

    expect(screen.getByText('Deleted "First".')).toBeInTheDocument()
    expect(screen.getByText('5s')).toBeInTheDocument()
    expect(screen.getByText('Deleted "Second".')).toBeInTheDocument()
    expect(screen.getByText('3s')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(2)
  })

  it('calls onUndo with the item id when its Undo button is clicked', () => {
    const onUndo = vi.fn()
    render(
      <UndoToast
        items={[{ id: 'link-1', message: 'Deleted "Only".', secondsLeft: 5 }]}
        onUndo={onUndo}
      />,
    )

    screen.getByRole('button', { name: 'Undo' }).click()

    expect(onUndo).toHaveBeenCalledWith('link-1')
  })

  it('gives each toast its own status region so it is announced once', () => {
    render(
      <UndoToast
        items={[{ id: '1', message: 'Deleted "Only".', secondsLeft: 5 }]}
        onUndo={vi.fn()}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Deleted "Only".')
  })
})
