import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

export default function SettingsPage() {
  const { user, setUser } = useAuth()
  const [profile, setProfile] = useState({
    displayName: user?.displayName || user?.display_name || '',
    username: user?.username || '',
    bio: user?.bio || '',
    profileVisibility: user?.profileVisibility || user?.profile_visibility || 'public',
    defaultPostAudience: user?.defaultPostAudience || user?.default_post_audience || 'friends',
    friendRequestPolicy: user?.friendRequestPolicy || user?.friend_request_policy || 'everyone',
    friendsListVisibility: user?.friendsListVisibility || user?.friends_list_visibility || 'friends'
  })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark')
  const [avatar, setAvatar] = useState(null)
  const [avatarBusy, setAvatarBusy] = useState(false)

  useEffect(() => {
    api('/api/profiles/me').then(data => {
      const next = data.user || data
      setProfile(current => ({
        ...current,
        displayName: next.displayName || next.display_name || '',
        username: next.username || '',
        bio: next.bio || '',
        profileVisibility: next.profileVisibility || next.profile_visibility || 'public',
        defaultPostAudience: next.defaultPostAudience || next.default_post_audience || 'friends',
        friendRequestPolicy: next.friendRequestPolicy || next.friend_request_policy || 'everyone',
        friendsListVisibility: next.friendsListVisibility || next.friends_list_visibility || 'friends'
      }))
    }).catch(() => {})
  }, [])

  function update(event) { setProfile({ ...profile, [event.target.name]: event.target.value }) }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaved(false)
    try {
      await api('/api/profiles/me', {
        method: 'PATCH',
        body: JSON.stringify({
          display_name: profile.displayName,
          username: profile.username,
          bio: profile.bio
        })
      })
      const data = await api('/api/profiles/me/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          profile_visibility: profile.profileVisibility,
          default_post_audience: profile.defaultPostAudience === 'only_me' ? 'private' : profile.defaultPostAudience,
          friend_requests_enabled: profile.friendRequestPolicy === 'everyone',
          friends_list_visible: profile.friendsListVisibility !== 'private'
        })
      })
      setUser(data.user || data)
      setSaved(true)
    } catch (err) { setError(err.message) }
  }

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
    localStorage.setItem('social-theme', next ? 'dark' : 'light')
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setAvatar(file)
    setAvatarBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.set('avatar', file)
      const data = await api('/api/profiles/me/avatar', { method: 'POST', body: form })
      setUser(data.user || data)
      setSaved(true)
    } catch (err) { setError(err.message) } finally { setAvatarBusy(false) }
  }

  return (
    <section className="narrow-page">
      <h1>Settings</h1>
      {error && <div className="alert" role="alert">{error}</div>}
      {saved && <div className="alert success" role="status">Settings saved.</div>}
      <form className="card settings-form" onSubmit={submit}>
        <h2>Profile</h2>
        <label>Avatar
          <input type="file" accept="image/*" onChange={uploadAvatar} disabled={avatarBusy} />
          {avatar && <small>{avatarBusy ? 'Uploading…' : `Selected ${avatar.name}`}</small>}
        </label>
        <label>Display name<input name="displayName" value={profile.displayName} onChange={update} /></label>
        <label>Username<input name="username" value={profile.username} onChange={update} /></label>
        <label>Bio<textarea name="bio" rows="3" value={profile.bio} onChange={update} /></label>
        <h2>Privacy</h2>
        <label>Profile visibility<select name="profileVisibility" value={profile.profileVisibility} onChange={update}><option value="public">Public</option><option value="friends">Friends only</option><option value="private">Private</option></select></label>
        <label>Default post audience<select name="defaultPostAudience" value={profile.defaultPostAudience} onChange={update}><option value="public">Public</option><option value="friends">Friends</option><option value="only_me">Only me</option></select></label>
        <label>Who can send friend requests<select name="friendRequestPolicy" value={profile.friendRequestPolicy} onChange={update}><option value="everyone">Everyone</option><option value="none">No one</option></select></label>
        <label>Friends list visibility<select name="friendsListVisibility" value={profile.friendsListVisibility} onChange={update}><option value="public">Public</option><option value="friends">Friends only</option><option value="private">Private</option></select></label>
        <h2>Appearance</h2>
        <label className="toggle-row"><span>Dark mode</span><input type="checkbox" checked={dark} onChange={toggleTheme} /></label>
        <button className="primary" type="submit">Save changes</button>
      </form>
    </section>
  )
}
