import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapList } from '../api'

export default function NotificationsPage() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')

  function load() { api('/api/notifications').then(data => setItems(unwrapList(data))).catch(err => setError(err.message)) }
  useEffect(() => { load(); const refresh = () => load(); window.addEventListener('social-live', refresh); return () => window.removeEventListener('social-live', refresh) }, [])

  async function markAll() {
    try {
      await api('/api/notifications/read-all', { method: 'POST', body: '{}' })
      load()
      window.dispatchEvent(new CustomEvent('social-unread-change', { detail: { unread: 0 } }))
    } catch (err) { setError(err.message) }
  }
  async function markOne(id) {
    try {
      await api(`/api/notifications/${id}/read`, { method: 'POST', body: '{}' })
      load()
      api('/api/notifications/unread').then(data => window.dispatchEvent(new CustomEvent('social-unread-change', { detail: { unread: data.unread ?? 0 } }))).catch(() => {})
    } catch (err) { setError(err.message) }
  }

  return (
    <section className="narrow-page">
      <div className="page-heading"><h1>Notifications</h1><button className="button secondary" onClick={markAll}>Mark all read</button></div>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="card list">
        {items.length === 0 ? <p className="empty-state">No notifications.</p> : items.map(item => (
          <article className={`notification ${item.unread === false || item.read || item.isRead || item.is_read ? '' : 'unread'}`} key={item.id}>
            {item.postId || item.post_id ? <Link to={`/posts/${item.postId || item.post_id}`} onClick={() => markOne(item.id)}>
              <strong>{item.actor?.displayName || item.actor?.display_name || 'Someone'}</strong> {item.message || item.type || 'interacted'}
            </Link> : <button className="notification-text" onClick={() => markOne(item.id)}>{item.message || item.type}</button>}
            {(item.unread !== false && !(item.read || item.isRead || item.is_read)) && <span className="unread-dot" aria-label="Unread" />}
          </article>
        ))}
      </div>
    </section>
  )
}
