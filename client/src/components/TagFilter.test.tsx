import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TagFilter } from './TagFilter'

describe('TagFilter', () => {
  it('renders nothing when there are no tags and no filter is active', () => {
    const { container } = render(
      <TagFilter tags={[]} selectedTag={undefined} onSelectTag={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('still renders when a filter is active even if the tag list is empty', () => {
    render(<TagFilter tags={[]} selectedTag="news" onSelectTag={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'Filter links by tag' })).toBeInTheDocument()
  })

  it('renders an "All" pill plus one pill per tag', () => {
    render(<TagFilter tags={['news', 'react']} selectedTag={undefined} onSelectTag={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'news' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'react' })).toBeInTheDocument()
  })

  it('marks "All" as pressed when no tag is selected', () => {
    render(<TagFilter tags={['news']} selectedTag={undefined} onSelectTag={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'news' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks the matching tag pill as pressed when a filter is applied', () => {
    render(<TagFilter tags={['news', 'react']} selectedTag="react" onSelectTag={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'react' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onSelectTag with the tag when an unselected pill is clicked', () => {
    const onSelectTag = vi.fn()
    render(<TagFilter tags={['news', 'react']} selectedTag={undefined} onSelectTag={onSelectTag} />)

    fireEvent.click(screen.getByRole('button', { name: 'react' }))

    expect(onSelectTag).toHaveBeenCalledWith('react')
  })

  it('calls onSelectTag with undefined when the already-selected tag is clicked again', () => {
    const onSelectTag = vi.fn()
    render(<TagFilter tags={['news', 'react']} selectedTag="react" onSelectTag={onSelectTag} />)

    fireEvent.click(screen.getByRole('button', { name: 'react' }))

    expect(onSelectTag).toHaveBeenCalledWith(undefined)
  })

  it('calls onSelectTag with undefined when "All" is clicked', () => {
    const onSelectTag = vi.fn()
    render(<TagFilter tags={['news', 'react']} selectedTag="react" onSelectTag={onSelectTag} />)

    fireEvent.click(screen.getByRole('button', { name: 'All' }))

    expect(onSelectTag).toHaveBeenCalledWith(undefined)
  })
})
