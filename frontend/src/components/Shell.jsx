import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth'
import { api } from '../api'
import { useWebSocket } from '../hooks'

function Icon({ name }) {
  const icons = { feed: '⌂', search: '⌕', friends: '♙', notifications: '♢', settings: '⚙', profile: '◯' }
  return <span aria-hidden="true">{icons[name]}</span>
}

export default function Shell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [liveMessage, setLiveMessage] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    api('/api/notifications/unread').then(d => setUnread(d.unread ?? d.count ?? 0)).catch(() => {})
  }, [])

  useWebSocket(message => {
    if (message.type === 'notification') {
      setUnread(count => count + 1)
      setLiveMessage(message.message || 'You have a new notification')
    } else if (message.type === 'post' || message.type === 'comment' || message.type === 'like') {
      setLiveMessage(message.message || 'Social feed updated')
      window.dispatchEvent(new CustomEvent('social-live', { detail: message }))
    }
  }, !!user)

  useEffect(() => {
    const handler = event => {
      const message = event.detail
      if (message.type === 'notification') setUnread(count => count + 1)
    }
    window.addEventListener('social-live', handler)
    const unreadHandler = event => setUnread(event.detail?.unread ?? 0)
    window.addEventListener('social-unread-change', unreadHandler)
    return () => {
      window.removeEventListener('social-live', handler)
      window.removeEventListener('social-unread-change', unreadHandler)
    }
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const username = user?.username || 'me'
  const links = [
    ['feed', 'Feed', '/feed'],
    ['search', 'Search', '/search'],
    ['friends', 'Friends', '/friends'],
    ['notifications', 'Notifications', '/notifications'],
    ['profile', 'Profile', `/profile/${username}`]
  ]

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/feed" aria-label="Social feed">Social</NavLink>
        <button className="avatar-button" onClick={() => setMenuOpen(open => !open)} aria-expanded={menuOpen} aria-label="Open account menu">
          <span className="avatar">{(user?.displayName || user?.display_name || username).slice(0, 1).toUpperCase()}</span>
        </button>
        {menuOpen && (
          <div className="account-menu">
            <NavLink to={`/profile/${username}`} onClick={() => setMenuOpen(false)}>View profile</NavLink>
            <NavLink to="/settings" onClick={() => setMenuOpen(false)}>Settings</NavLink>
            <button onClick={handleLogout}>Log out</button>
          </div>
        )}
      </header>
      <nav className="desktop-nav" aria-label="Primary navigation">
        {links.map(([icon, label, to]) => (
          <NavLink key={to} to={to}>
            <Icon name={icon} /> <span>{label}</span>
            {label === 'Notifications' && unread > 0 && <b className="badge" aria-label={`${unread} unread notifications`}>{unread}</b>}
          </NavLink>
        ))}
        <NavLink to="/settings"><Icon name="settings" /> <span>Settings</span></NavLink>
      </nav>
      <main className="main-content"><Outlet /></main>
      <nav className="bottom-nav" aria-label="Primary navigation">
        {links.slice(0, 5).map(([icon, label, to]) => (
          <NavLink key={to} to={to} aria-label={label}>
            <span className="bottom-icon"><Icon name={icon} />{label === 'Notifications' && unread > 0 && <b className="badge-dot" aria-label={`${unread} unread`}>{unread > 9 ? '9+' : unread}</b>}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="live-region" aria-live="polite" aria-atomic="true">{liveMessage}</div>
    </div>
  )
}
