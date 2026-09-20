import './TagList.css'

export interface TagListProps {
  tags: string[]
  /** Accessible label for the whole list, e.g. `Tags for My Article`. */
  label: string
}

/**
 * Renders a link's tags as small pills. Renders nothing when there are no
 * tags — callers that want an empty-state message decide that themselves.
 */
export function TagList({ tags, label }: TagListProps) {
  if (tags.length === 0) return null

  return (
    <ul className="tag-list" aria-label={label}>
      {tags.map((tag) => (
        <li key={tag} className="tag-list__item">
          {tag}
        </li>
      ))}
    </ul>
  )
}
