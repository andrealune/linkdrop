import { env } from './config/env'
import { useApiHealth } from './hooks/useApiHealth'
import { StatusBadge } from './components/StatusBadge'
import { LinkList } from './components/LinkList'
import './App.css'

function App() {
  const apiStatus = useApiHealth()

  return (
    <main className="app">
      <header className="app__header">
        <h1>Linkdrop</h1>
        <StatusBadge state={apiStatus} />
      </header>

      <p className="app__lede">
        Saved links, newest first. The add-link form and delete/undo flow land in later tasks.
      </p>

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
