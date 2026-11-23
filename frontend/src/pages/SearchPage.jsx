import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, unwrapList } from '../api'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const q = params.get('q')
    if (!q) { setUsers([]); return }
    api(`/api/profiles/search?q=${encodeURIComponent(q)}`).then(data => setUsers(unwrapList(data, 'users'))).catch(err => setError(err.message))
  }, [params])

  function submit(event) {
    event.preventDefault()
    setParams(query ? { q: query } : {})
  }

  return (
    <section className="narrow-page">
      <h1>Search people</h1>
      <form className="search-form" onSubmit={submit} role="search">
        <label className="sr-only" htmlFor="search-query">Search by name or username</label>
        <input id="search-query" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or username" />
        <button className="primary" type="submit">Search</button>
      </form>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="card list">
        {users.length === 0 ? <p className="empty-state">{params.get('q') ? 'No users found.' : 'Start typing to find people.'}</p> : users.map(person => (
          <article className="list-row" key={person.id}>
            <Link className="avatar small" to={`/profile/${person.username}`}>{(person.displayName || person.display_name || person.username).slice(0, 1).toUpperCase()}</Link>
            <Link to={`/profile/${person.username}`}><strong>{person.displayName || person.display_name || person.username}</strong><br /><small>@{person.username}</small></Link>
          </article>
        ))}
      </div>
    </section>
  )
}
