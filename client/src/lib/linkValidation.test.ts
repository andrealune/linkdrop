import { describe, expect, it } from 'vitest'
import { TITLE_MAX_LENGTH, URL_MAX_LENGTH, validateTitle, validateUrl } from './linkValidation'

describe('validateUrl', () => {
  it('rejects an empty value', () => {
    expect(validateUrl('')).toBe('Enter a URL.')
    expect(validateUrl('   ')).toBe('Enter a URL.')
  })

  it('rejects a value that is not a well-formed URL', () => {
    expect(validateUrl('not a url')).toMatch(/valid URL/)
  })

  it('rejects protocols other than http/https', () => {
    expect(validateUrl('ftp://example.com/file')).toMatch(/http:\/\/ or https:\/\//)
    expect(validateUrl('javascript:alert(1)')).toMatch(/http:\/\/ or https:\/\//)
  })

  it('rejects a URL longer than the max length', () => {
    const longUrl = `https://example.com/${'a'.repeat(URL_MAX_LENGTH)}`
    expect(validateUrl(longUrl)).toMatch(`${URL_MAX_LENGTH} characters or fewer`)
  })

  it('accepts a well-formed http or https URL', () => {
    expect(validateUrl('https://example.com')).toBeUndefined()
    expect(validateUrl('  http://example.com/path?query=1  ')).toBeUndefined()
  })

  it('accepts a URL at exactly the max length', () => {
    const prefix = 'https://example.com/'
    const url = `${prefix}${'a'.repeat(URL_MAX_LENGTH - prefix.length)}`
    expect(url.length).toBe(URL_MAX_LENGTH)
    expect(validateUrl(url)).toBeUndefined()
  })
})

describe('validateTitle', () => {
  it('accepts an empty title', () => {
    expect(validateTitle('')).toBeUndefined()
  })

  it('accepts a title within the limit', () => {
    expect(validateTitle('A short title')).toBeUndefined()
  })

  it('rejects a title longer than the max length', () => {
    expect(validateTitle('a'.repeat(TITLE_MAX_LENGTH + 1))).toMatch(
      `${TITLE_MAX_LENGTH} characters or fewer`,
    )
  })

  it('accepts a title at exactly the max length', () => {
    expect(validateTitle('a'.repeat(TITLE_MAX_LENGTH))).toBeUndefined()
  })
})
