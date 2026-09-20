import { env } from './config/env'
import { useApiHealth } from './hooks/useApiHealth'
import { StatusBadge } from './components/StatusBadge'
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
        Project scaffolding is ready. The link list, add-link form and delete/undo flow land in
        later tasks.
      </p>

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
