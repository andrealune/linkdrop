import { useCallback, useState } from 'react'
import { env } from './config/env'
import { useApiHealth } from './hooks/useApiHealth'
import { StatusBadge } from './components/StatusBadge'
import { LinkList } from './components/LinkList'
import { AddLinkForm } from './components/AddLinkForm'
import { TagFilter } from './components/TagFilter'
import type { Link } from './api/links'
import './App.css'

function App() {
  const apiStatus = useApiHealth()
  const [recentlyAdded, setRecentlyAdded] = useState<Link[]>([])
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined)
  const [visibleTags, setVisibleTags] = useState<string[]>([])

  // Tags on offer in the filter track whatever's actually on screen right
  // now (the current page of the current filter), so they stay in sync
  // with pagination and with the filter itself.
  const handleItemsChange = useCallback((items: Link[]) => {
    const unique = new Set<string>()
    for (const item of items) {
      for (const tag of item.tags) unique.add(tag)
    }
    setVisibleTags(Array.from(unique).sort())
  }, [])

  return (
    <main className="app">
      <header className="app__header">
        <h1>Linkdrop</h1>
        <StatusBadge state={apiStatus} />
      </header>

      <p className="app__lede">
        Save a link below, then browse and filter your saved links by tag. Delete/undo flow
        lands in a later task.
      </p>

      <section className="app__section" aria-labelledby="add-link-heading">
        <h2 id="add-link-heading">Add a link</h2>
        <AddLinkForm onLinkAdded={(link) => setRecentlyAdded((prev) => [link, ...prev])} />
      </section>

      {recentlyAdded.length > 0 ? (
        <section className="app__section" aria-labelledby="recent-heading">
          <h2 id="recent-heading">Just added</h2>
          <ul className="app__recent-list">
            {recentlyAdded.map((link) => (
              <li key={link.id}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="app__section app__filter" aria-labelledby="filter-heading">
        <h2 id="filter-heading">Filter by tag</h2>
        <TagFilter tags={visibleTags} selectedTag={selectedTag} onSelectTag={setSelectedTag} />
      </section>

      <section className="app__links" aria-label="Saved links">
        <LinkList tag={selectedTag} onItemsChange={handleItemsChange} />
      </section>

      <dl className="app__config">
        <div>
          <dt>API URL</dt>
          <dd>
            <code>{env.apiUrl}</code>
          </dd>
        </div>
      </dl>
    </main>
  )
}

export default App
