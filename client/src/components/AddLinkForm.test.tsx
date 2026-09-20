import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AddLinkForm } from './AddLinkForm'
import { ApiError } from '../api/client'
import { createLink } from '../api/links'
import type { Link } from '../api/links'

vi.mock('../api/links', () => ({
  createLink: vi.fn(),
}))

const mockedCreateLink = createLink as unknown as ReturnType<typeof vi.fn>

const sampleLink: Link = {
  id: '1',
  url: 'https://example.com/article',
  title: 'Example',
  tags: [],
  createdAt: '2024-01-01T00:00:00.000Z',
}

function getUrlInput() {
  return screen.getByLabelText('URL')
}

function getTitleInput() {
  return screen.getByLabelText(/Title/)
}

function getSubmitButton() {
  return screen.getByRole('button', { name: /add link/i })
}

describe('AddLinkForm', () => {
  afterEach(() => {
    mockedCreateLink.mockReset()
  })

  it('renders the URL and title fields and the submit button', () => {
    render(<AddLinkForm />)
    expect(getUrlInput()).toBeInTheDocument()
    expect(getTitleInput()).toBeInTheDocument()
    expect(getSubmitButton()).toBeInTheDocument()
  })

  it('shows a required error when submitting an empty URL, and does not call the API', async () => {
    const user = userEvent.setup()
    render(<AddLinkForm />)

    await user.click(getSubmitButton())

    expect(await screen.findByText('Enter a URL.')).toBeInTheDocument()
    expect(getUrlInput()).toHaveAttribute('aria-invalid', 'true')
    expect(mockedCreateLink).not.toHaveBeenCalled()
  })

  it('shows a format error for a malformed URL', async () => {
    const user = userEvent.setup()
    render(<AddLinkForm />)

    await user.type(getUrlInput(), 'not a url')
    await user.click(getSubmitButton())

    expect(await screen.findByText(/valid URL/)).toBeInTheDocument()
    expect(mockedCreateLink).not.toHaveBeenCalled()
  })

  it('rejects non-http(s) schemes', async () => {
    const user = userEvent.setup()
    render(<AddLinkForm />)

    await user.type(getUrlInput(), 'ftp://example.com/file')
    await user.click(getSubmitButton())

    expect(await screen.findByText(/http:\/\/ or https:\/\//)).toBeInTheDocument()
    expect(mockedCreateLink).not.toHaveBeenCalled()
  })

  it('shows a length error for a title over the limit', async () => {
    const user = userEvent.setup()
    render(<AddLinkForm />)

    await user.type(getUrlInput(), 'https://example.com')
    await user.type(getTitleInput(), 'a'.repeat(201))
    await user.click(getSubmitButton())

    expect(await screen.findByText(/200 characters or fewer/)).toBeInTheDocument()
    expect(mockedCreateLink).not.toHaveBeenCalled()
  })

  it('clears a field error as soon as the value becomes valid again', async () => {
    const user = userEvent.setup()
    render(<AddLinkForm />)

    await user.click(getSubmitButton())
    expect(await screen.findByText('Enter a URL.')).toBeInTheDocument()

    await user.type(getUrlInput(), 'https://example.com')
    await waitFor(() => expect(screen.queryByText('Enter a URL.')).not.toBeInTheDocument())
  })

  it('validates the URL on blur, before the form is ever submitted', async () => {
    const user = userEvent.setup()
    render(<AddLinkForm />)

    await user.click(getUrlInput())
    await user.tab()

    expect(await screen.findByText('Enter a URL.')).toBeInTheDocument()
    expect(mockedCreateLink).not.toHaveBeenCalled()
  })

  it('validates the title on blur once it exceeds the length limit', async () => {
    const user = userEvent.setup()
    render(<AddLinkForm />)

    await user.type(getTitleInput(), 'a'.repeat(201))
    await user.tab()

    expect(await screen.findByText(/200 characters or fewer/)).toBeInTheDocument()
  })

  it('treats a whitespace-only title as blank and omits it from the request', async () => {
    mockedCreateLink.mockResolvedValue(sampleLink)
    const user = userEvent.setup()
    render(<AddLinkForm />)

    await user.type(getUrlInput(), 'https://example.com')
    await user.type(getTitleInput(), '   ')
    await user.click(getSubmitButton())

    await waitFor(() =>
      expect(mockedCreateLink).toHaveBeenCalledWith({ url: 'https://example.com' }),
    )
  })

  it('submits the trimmed URL and title, then clears the form on success', async () => {
    mockedCreateLink.mockResolvedValue(sampleLink)
    const onLinkAdded = vi.fn()
    const user = userEvent.setup()
    render(<AddLinkForm onLinkAdded={onLinkAdded} />)

    await user.type(getUrlInput(), '  https://example.com/article  ')
    await user.type(getTitleInput(), '  My title  ')
    await user.click(getSubmitButton())

    await waitFor(() =>
      expect(mockedCreateLink).toHaveBeenCalledWith({
        url: 'https://example.com/article',
        title: 'My title',
      }),
    )
    expect(onLinkAdded).toHaveBeenCalledWith(sampleLink)
    await waitFor(() => expect(getUrlInput()).toHaveValue(''))
    expect(getTitleInput()).toHaveValue('')
    expect(await screen.findByText('Link added.')).toBeInTheDocument()
  })

  it('omits the title from the request when left blank', async () => {
    mockedCreateLink.mockResolvedValue(sampleLink)
    const user = userEvent.setup()
    render(<AddLinkForm />)

    await user.type(getUrlInput(), 'https://example.com')
    await user.click(getSubmitButton())

    await waitFor(() =>
      expect(mockedCreateLink).toHaveBeenCalledWith({ url: 'https://example.com' }),
    )
  })

  it('shows a form-level error and keeps the URL when the server rejects the URL with a title present', async () => {
    mockedCreateLink.mockRejectedValue(new ApiError('URL is not reachable', 422))
    const user = userEvent.setup()
    render(<AddLinkForm />)

    await user.type(getUrlInput(), 'https://example.com')
    await user.type(getTitleInput(), 'My title')
    await user.click(getSubmitButton())

    expect(await screen.findByText('URL is not reachable')).toBeInTheDocument()
    expect(getUrlInput()).toHaveValue('https://example.com')
    expect(getUrlInput()).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows a network error as a form-level message', async () => {
    mockedCreateLink.mockRejectedValue(new ApiError('Failed to fetch', 0))
    const user = userEvent.setup()
    render(<AddLinkForm />)

    await user.type(getUrlInput(), 'https://example.com')
    await user.type(getTitleInput(), 'My title')
    await user.click(getSubmitButton())

    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument()
  })

  it('invites manual title entry when the automatic title fetch fails, then succeeds on retry', async () => {
    mockedCreateLink
      .mockRejectedValueOnce(new ApiError('Timed out fetching title', 502))
      .mockResolvedValueOnce(sampleLink)
    const user = userEvent.setup()
    render(<AddLinkForm />)

    await user.type(getUrlInput(), 'https://example.com/article')
    await user.click(getSubmitButton())

    expect(
      await screen.findByText(/couldn't fetch a title for that page automatically/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/couldn't fetch a title automatically — type one above/i),
    ).toBeInTheDocument()
    // The URL is preserved so the user only has to add a title.
    expect(getUrlInput()).toHaveValue('https://example.com/article')

    await user.type(getTitleInput(), 'Manually entered title')
    await user.click(getSubmitButton())

    await waitFor(() =>
      expect(mockedCreateLink).toHaveBeenLastCalledWith({
        url: 'https://example.com/article',
        title: 'Manually entered title',
      }),
    )
    expect(await screen.findByText('Link added.')).toBeInTheDocument()
    expect(
      screen.queryByText(/couldn't fetch a title automatically — type one above/i),
    ).not.toBeInTheDocument()
  })

  it('disables the submit button and shows progress text while submitting', async () => {
    let resolveCreate: (value: Link) => void = () => {}
    mockedCreateLink.mockImplementation(
      () =>
        new Promise<Link>((resolve) => {
          resolveCreate = resolve
        }),
    )
    const user = userEvent.setup()
    render(<AddLinkForm />)

    await user.type(getUrlInput(), 'https://example.com')
    const button = getSubmitButton()
    await user.click(button)

    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(/adding/i)

    resolveCreate(sampleLink)
    await waitFor(() => expect(button).not.toBeDisabled())
  })
})
