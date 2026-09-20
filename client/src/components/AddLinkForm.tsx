import { useId, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { ApiError } from '../api/client'
import { createLink } from '../api/links'
import type { Link } from '../api/links'
import { validateTitle, validateUrl } from '../lib/linkValidation'
import './AddLinkForm.css'

export interface AddLinkFormProps {
  /** Called with the newly created link after a successful submit. */
  onLinkAdded?: (link: Link) => void
}

interface FieldErrors {
  url?: string
  title?: string
}

type Status = 'idle' | 'submitting' | 'success'

/**
 * Form to save a new link.
 *
 * - Validates the URL and title inline (format, required-ness, length
 *   limits) before ever hitting the network.
 * - Title is optional: when left blank the server fetches the page title.
 *   If that submit fails, we assume the automatic title fetch is the most
 *   likely culprit (a slow or unreachable page) and invite the user to type
 *   a title themselves and retry, rather than making them re-diagnose a
 *   generic error.
 * - Any other failure (validation rejected by the server, network error) is
 *   shown as a form-level message; a server-reported URL problem is mapped
 *   back onto the URL field so it reads like the rest of the inline errors.
 */
export function AddLinkForm({ onLinkAdded }: AddLinkFormProps) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [touched, setTouched] = useState<{ url: boolean; title: boolean }>({
    url: false,
    title: false,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [formError, setFormError] = useState<string | null>(null)
  const [titleFetchFailed, setTitleFetchFailed] = useState(false)

  const urlInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const idPrefix = useId()
  const urlFieldId = `${idPrefix}-url`
  const titleFieldId = `${idPrefix}-title`
  const urlErrorId = `${idPrefix}-url-error`
  const titleErrorId = `${idPrefix}-title-error`
  const formErrorId = `${idPrefix}-form-error`

  function handleUrlChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    setUrl(value)
    if (touched.url) {
      setErrors((prev) => ({ ...prev, url: validateUrl(value) }))
    }
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    setTitle(value)
    if (touched.title) {
      setErrors((prev) => ({ ...prev, title: validateTitle(value) }))
    }
    if (titleFetchFailed) {
      setTitleFetchFailed(false)
      setFormError(null)
    }
  }

  function handleUrlBlur() {
    setTouched((prev) => ({ ...prev, url: true }))
    setErrors((prev) => ({ ...prev, url: validateUrl(url) }))
  }

  function handleTitleBlur() {
    setTouched((prev) => ({ ...prev, title: true }))
    setErrors((prev) => ({ ...prev, title: validateTitle(title) }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const urlError = validateUrl(url)
    const titleError = validateTitle(title)
    setTouched({ url: true, title: true })
    setErrors({ url: urlError, title: titleError })

    if (urlError) {
      urlInputRef.current?.focus()
      return
    }
    if (titleError) {
      titleInputRef.current?.focus()
      return
    }

    setStatus('submitting')
    setFormError(null)
    setTitleFetchFailed(false)

    const trimmedUrl = url.trim()
    const trimmedTitle = title.trim()

    try {
      const link = await createLink({
        url: trimmedUrl,
        ...(trimmedTitle ? { title: trimmedTitle } : {}),
      })

      setUrl('')
      setTitle('')
      setTouched({ url: false, title: false })
      setErrors({})
      setStatus('success')
      onLinkAdded?.(link)
      urlInputRef.current?.focus()
      return
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : undefined

      if (cause instanceof ApiError && trimmedTitle === '') {
        // No title was supplied, so the server would have tried to fetch
        // one itself. Treat the failure as that step going wrong and let
        // the user supply a title by hand instead of guessing what to fix.
        setTitleFetchFailed(true)
        setFormError(
          "We couldn't fetch a title for that page automatically. Enter one below and try again.",
        )
        titleInputRef.current?.focus()
      } else if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) {
        // A 4xx with a title present is most likely the server rejecting
        // the URL itself (e.g. a scheme or host it refuses to save).
        setErrors((prev) => ({
          ...prev,
          url: message ?? 'That URL was rejected. Check it and try again.',
        }))
        urlInputRef.current?.focus()
      } else {
        setFormError(message ?? 'Something went wrong saving that link. Try again.')
      }

      setStatus('idle')
    }
  }

  const urlError = errors.url
  const titleError = errors.title

  return (
    <form className="add-link-form" onSubmit={handleSubmit} noValidate>
      <div className="add-link-form__field">
        <label htmlFor={urlFieldId}>URL</label>
        <input
          ref={urlInputRef}
          id={urlFieldId}
          name="url"
          type="url"
          inputMode="url"
          placeholder="https://example.com/article"
          value={url}
          onChange={handleUrlChange}
          onBlur={handleUrlBlur}
          aria-required="true"
          aria-invalid={urlError ? 'true' : 'false'}
          aria-describedby={urlError ? urlErrorId : undefined}
          disabled={status === 'submitting'}
        />
        {urlError ? (
          <p id={urlErrorId} className="add-link-form__error" role="alert">
            {urlError}
          </p>
        ) : null}
      </div>

      <div className="add-link-form__field">
        <label htmlFor={titleFieldId}>
          Title <span className="add-link-form__optional">(optional)</span>
        </label>
        <input
          ref={titleInputRef}
          id={titleFieldId}
          name="title"
          type="text"
          placeholder="We'll fetch this from the page if you leave it blank"
          value={title}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          aria-invalid={titleError ? 'true' : 'false'}
          aria-describedby={titleError ? titleErrorId : undefined}
          disabled={status === 'submitting'}
        />
        {titleError ? (
          <p id={titleErrorId} className="add-link-form__error" role="alert">
            {titleError}
          </p>
        ) : null}
        {titleFetchFailed ? (
          <p className="add-link-form__hint">
            Couldn't fetch a title automatically — type one above.
          </p>
        ) : null}
      </div>

      {formError ? (
        <p id={formErrorId} className="add-link-form__form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="add-link-form__actions">
        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Adding…' : 'Add link'}
        </button>
        <span className="add-link-form__status" role="status" aria-live="polite">
          {status === 'success' ? 'Link added.' : ''}
        </span>
      </div>
    </form>
  )
}
