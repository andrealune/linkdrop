import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TagList } from './TagList'

describe('TagList', () => {
  it('renders each tag as a list item inside an accessible, labelled list', () => {
    render(<TagList tags={['news', 'react']} label="Tags for Example" />)

    const list = screen.getByRole('list', { name: 'Tags for Example' })
    expect(list).toBeInTheDocument()
    expect(screen.getByText('news')).toBeInTheDocument()
    expect(screen.getByText('react')).toBeInTheDocument()
  })

  it('renders nothing when there are no tags', () => {
    const { container } = render(<TagList tags={[]} label="Tags for Example" />)
    expect(container).toBeEmptyDOMElement()
  })
})
