import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapList } from '../api'

export default function FriendsPage() {
  const [tab, setTab] = useState('friends')
  const [items, setItems] = useState([])
  const [error, setError] = useState('')

  function load() {
    if (tab === 'friends') {
      api('/api/friends').then(data => setItems(unwrapList(data))).catch(err => setError(err.message))
      return
    }
    api('/api/friends/pending')
      .then(data => setItems(tab === 'incoming' ? (data.incoming || []) : (data.outgoing || [])))
      .catch(err => setError(err.message))
  }
  useEffect(() => { load() }, [tab])

  async function action(request, type) {
    try {
      const id = request.id || request.requestId || request.request_id
      await api(`/api/friend-requests/${id}/${type}`, { method: type === 'decline' || type === 'cancel' ? 'DELETE' : 'POST', body: '{}' })
      load()
    } catch (err) { setError(err.message) }
  }

  return (
    <section className="narrow-page">
      <h1>Friends</h1>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="tabs" role="tablist" aria-label="Friend lists">
        {['friends', 'incoming', 'outgoing'].map(value => <button role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} key={value} onClick={() => setTab(value)}>{value}</button>)}
      </div>
      <div className="card list">
        {items.length === 0 ? <p className="empty-state">Nothing here yet.</p> : items.map(item => {
          const person = item.user || item.requester || item.recipient || item
          const username = person.username || 'user'
          return (
            <article className="list-row" key={item.id || person.id}>
              <Link className="avatar small" to={`/profile/${username}`}>{(person.displayName || person.display_name || username).slice(0, 1).toUpperCase()}</Link>
              <Link to={`/profile/${username}`}><strong>{person.displayName || person.display_name || username}</strong><br /><small>@{username}</small></Link>
              {tab === 'incoming' && <div className="row-actions"><button className="primary" onClick={() => action(item, 'accept')}>Accept</button><button onClick={() => action(item, 'decline')}>Decline</button></div>}
              {tab === 'outgoing' && <button onClick={() => action(item, 'cancel')}>Cancel</button>}
            </article>
          )
        })}
      </div>
    </section>
  )
}
