import './TagFilter.css'

export interface TagFilterProps {
  /**
   * Tags the visitor can filter by. Typically the unique tags found on the
   * links currently on screen, so the choices on offer track pagination and
   * the active filter rather than every tag that has ever been used.
   */
  tags: string[]
  /** The tag currently applied, or `undefined` when no filter is active. */
  selectedTag?: string
  /** Called with the tag to filter by, or `undefined` to clear the filter. */
  onSelectTag: (tag: string | undefined) => void
}

/**
 * Lets the visitor narrow the link list down to a single tag by clicking a
 * pill. Clicking the already-selected tag (or "All") clears the filter.
 *
 * Renders nothing when there is nothing to filter by — no tags on the
 * current page and no filter currently applied — so it disappears until
 * there is something useful to show.
 */
export function TagFilter({ tags, selectedTag, onSelectTag }: TagFilterProps) {
  if (tags.length === 0 && !selectedTag) return null

  return (
    <div className="tag-filter" role="group" aria-label="Filter links by tag">
      <button
        type="button"
        className="tag-filter__pill"
        aria-pressed={selectedTag === undefined}
        onClick={() => onSelectTag(undefined)}
      >
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          className="tag-filter__pill"
          aria-pressed={tag === selectedTag}
          onClick={() => onSelectTag(tag === selectedTag ? undefined : tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}
