import { useState } from 'react'
import { env } from './config/env'
import { useApiHealth } from './hooks/useApiHealth'
import { StatusBadge } from './components/StatusBadge'
import { LinkList } from './components/LinkList'
import { AddLinkForm } from './components/AddLinkForm'
import type { Link } from './api/links'
import './App.css'

function App() {
  const apiStatus = useApiHealth()
  const [recentlyAdded, setRecentlyAdded] = useState<Link[]>([])

  return (
    <main className="app">
      <header className="app__header">
        <h1>Linkdrop</h1>
        <StatusBadge state={apiStatus} />
      </header>

      <p className="app__lede">
        Save a link below and browse your saved links. Tag filtering and delete/undo flow land in
        later tasks.
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

      <section className="app__links" aria-label="Saved links">
        <LinkList />
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
