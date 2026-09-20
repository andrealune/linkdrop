import { fireEvent, render, screen, waitFor, within, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LinkList } from './LinkList'
import type { Link, ListLinksResult } from '../api/links'

vi.mock('../api/links', () => ({
  listLinks: vi.fn(),
  deleteLink: vi.fn(),
}))

import { listLinks, deleteLink } from '../api/links'

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: '1',
    url: 'https://example.com/article',
    title: 'Example Article',
    tags: ['news', 'react'],
    createdAt: '2024-03-15T12:00:00.000Z',
    ...overrides,
  }
}

function page(items: Link[], nextCursor: string | null = null): ListLinksResult {
  return { items, nextCursor }
}

describe('LinkList', () => {
  afterEach(() => {
    vi.resetAllMocks()
    vi.useRealTimers()
  })

  it('shows a loading state while the first page is in flight', () => {
    vi.mocked(listLinks).mockReturnValue(new Promise(() => {}))

    render(<LinkList />)

    expect(screen.getByText('Loading links…')).toBeInTheDocument()
  })

  it('shows an empty state when there are no links', async () => {
    vi.mocked(listLinks).mockResolvedValue(page([]))

    render(<LinkList />)

    await waitFor(() => expect(screen.getByText('No links yet.')).toBeInTheDocument())
  })

  it('shows an error state when the first page fails to load', async () => {
    vi.mocked(listLinks).mockRejectedValue(new Error('server unreachable'))

    render(<LinkList />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('server unreachable')
  })

  it('renders title, URL, creation date and tags for each link', async () => {
    const link = makeLink()
    vi.mocked(listLinks).mockResolvedValue(page([link]))

    render(<LinkList />)

    const item = await screen.findByRole('link', { name: 'Example Article' })
    expect(item).toHaveAttribute('href', 'https://example.com/article')

    const listItem = item.closest('li')
    expect(listItem).not.toBeNull()
    const scoped = within(listItem as HTMLElement)

    expect(scoped.getByText('example.com')).toBeInTheDocument()
    expect(scoped.getByText('Mar 15, 2024')).toBeInTheDocument()
    expect(scoped.getByText('news')).toBeInTheDocument()
    expect(scoped.getByText('react')).toBeInTheDocument()
  })

  it('falls back to the hostname when a link has no title', async () => {
    vi.mocked(listLinks).mockResolvedValue(page([makeLink({ title: '' })]))

    render(<LinkList />)

    expect(await screen.findByRole('link', { name: 'example.com' })).toBeInTheDocument()
  })

  it('disables Previous on the first page and Next when there is no further page', async () => {
    vi.mocked(listLinks).mockResolvedValue(page([makeLink()], null))

    render(<LinkList />)

    await screen.findByRole('link', { name: 'Example Article' })

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('paginates forward and back using the cursor returned by the API', async () => {
    const firstLink = makeLink({ id: '1', title: 'First Link' })
    const secondLink = makeLink({ id: '2', title: 'Second Link' })

    vi.mocked(listLinks)
      .mockResolvedValueOnce(page([firstLink], 'cursor-2'))
      .mockResolvedValueOnce(page([secondLink], null))
      .mockResolvedValueOnce(page([firstLink], 'cursor-2'))

    render(<LinkList />)

    await screen.findByRole('link', { name: 'First Link' })
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await screen.findByRole('link', { name: 'Second Link' })
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(listLinks).toHaveBeenNthCalledWith(2, { tag: undefined, cursor: 'cursor-2' })

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))

    await screen.findByRole('link', { name: 'First Link' })
    expect(listLinks).toHaveBeenNthCalledWith(3, { tag: undefined, cursor: undefined })
  })

  it('resets to page 1 when the tag filter changes', async () => {
    vi.mocked(listLinks).mockResolvedValue(page([makeLink()], 'cursor-2'))

    const { rerender } = render(<LinkList tag="news" />)

    await screen.findByRole('link', { name: 'Example Article' })

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(listLinks).toHaveBeenCalledTimes(2))

    rerender(<LinkList tag="react" />)

    await waitFor(() =>
      expect(listLinks).toHaveBeenLastCalledWith({ tag: 'react', cursor: undefined }),
    )
  })

  it('passes the tag filter through to the API', async () => {
    vi.mocked(listLinks).mockResolvedValue(page([makeLink()]))

    render(<LinkList tag="news" />)

    await screen.findByRole('link', { name: 'Example Article' })
    expect(listLinks).toHaveBeenCalledWith({ tag: 'news', cursor: undefined })
  })

  it('calls onItemsChange with the items on the current page once they load', async () => {
    const link = makeLink()
    vi.mocked(listLinks).mockResolvedValue(page([link]))
    const onItemsChange = vi.fn()

    render(<LinkList onItemsChange={onItemsChange} />)

    await waitFor(() => expect(onItemsChange).toHaveBeenCalledWith([link]))
  })

  it('calls onItemsChange again with the new page after paginating', async () => {
    const firstLink = makeLink({ id: '1', title: 'First Link' })
    const secondLink = makeLink({ id: '2', title: 'Second Link' })
    vi.mocked(listLinks)
      .mockResolvedValueOnce(page([firstLink], 'cursor-2'))
      .mockResolvedValueOnce(page([secondLink], null))
    const onItemsChange = vi.fn()

    render(<LinkList onItemsChange={onItemsChange} />)

    await waitFor(() => expect(onItemsChange).toHaveBeenCalledWith([firstLink]))

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(onItemsChange).toHaveBeenLastCalledWith([secondLink]))
  })

  describe('delete and undo (LAR-34)', () => {
    it('disables the Delete button when no admin token is set', async () => {
      vi.mocked(listLinks).mockResolvedValue(page([makeLink()]))

      render(<LinkList />)

      await screen.findByRole('link', { name: 'Example Article' })
      expect(screen.getByRole('button', { name: 'Delete Example Article' })).toBeDisabled()
    })

    it('enables the Delete button once an admin token is set', async () => {
      vi.mocked(listLinks).mockResolvedValue(page([makeLink()]))

      render(<LinkList adminToken="secret-token" />)

      await screen.findByRole('link', { name: 'Example Article' })
      expect(screen.getByRole('button', { name: 'Delete Example Article' })).toBeEnabled()
    })

    it('hides the link immediately and shows an undo toast, without calling the API yet', async () => {
      vi.mocked(listLinks).mockResolvedValue(page([makeLink()]))

      render(<LinkList adminToken="secret-token" />)

      await screen.findByRole('link', { name: 'Example Article' })
      fireEvent.click(screen.getByRole('button', { name: 'Delete Example Article' }))

      expect(screen.queryByRole('link', { name: 'Example Article' })).not.toBeInTheDocument()
      expect(screen.getByText('Deleted "Example Article".')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
      expect(deleteLink).not.toHaveBeenCalled()
    })

    it('restores the link and never calls the API when Undo is clicked within the window', async () => {
      vi.mocked(listLinks).mockResolvedValue(page([makeLink()]))
      vi.mocked(deleteLink).mockResolvedValue(undefined)
      vi.useFakeTimers()

      render(<LinkList adminToken="secret-token" />)

      await vi.waitFor(() =>
        expect(screen.getByRole('link', { name: 'Example Article' })).toBeInTheDocument(),
      )

      fireEvent.click(screen.getByRole('button', { name: 'Delete Example Article' }))
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

      expect(screen.getByRole('link', { name: 'Example Article' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000)
      })

      expect(deleteLink).not.toHaveBeenCalled()
      expect(screen.getByRole('link', { name: 'Example Article' })).toBeInTheDocument()
    })

    it('calls DELETE with the admin token once the countdown finishes, then drops the toast', async () => {
      vi.mocked(listLinks).mockResolvedValue(page([makeLink()]))
      vi.mocked(deleteLink).mockResolvedValue(undefined)
      vi.useFakeTimers()

      render(<LinkList adminToken="secret-token" />)

      await vi.waitFor(() =>
        expect(screen.getByRole('link', { name: 'Example Article' })).toBeInTheDocument(),
      )

      fireEvent.click(screen.getByRole('button', { name: 'Delete Example Article' }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      expect(deleteLink).toHaveBeenCalledWith('1', 'secret-token')
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Example Article' })).not.toBeInTheDocument()
    })

    it('restores the link with an error message if the deferred delete call fails', async () => {
      vi.mocked(listLinks).mockResolvedValue(page([makeLink()]))
      vi.mocked(deleteLink).mockRejectedValue(new Error('Unauthorized'))
      vi.useFakeTimers()

      render(<LinkList adminToken="wrong-token" />)

      await vi.waitFor(() =>
        expect(screen.getByRole('link', { name: 'Example Article' })).toBeInTheDocument(),
      )

      fireEvent.click(screen.getByRole('button', { name: 'Delete Example Article' }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      expect(screen.getByRole('link', { name: 'Example Article' })).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Couldn\'t delete "Example Article": Unauthorized. It\'s back in your list.',
      )
    })
  })
})
