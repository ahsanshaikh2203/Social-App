import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, unwrapList } from '../api'
import { useAuth } from '../auth'
import PostCard from '../components/PostCard'

export default function ProfilePage() {
  const { username } = useParams()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [error, setError] = useState('')
  const [friendBusy, setFriendBusy] = useState(false)
  const isOwner = user?.username === username

  function load() {
    api(`/api/profiles/${encodeURIComponent(username)}`)
      .then(profileData => {
        const profile = profileData.user || profileData
        setProfile(profile)
        return api(`/api/posts/profile/${profile.user_id}`)
      })
      .then(postData => setPosts(unwrapList(postData, 'posts')))
      .catch(err => setError(err.message))
  }
  useEffect(() => { load() }, [username])

  async function friendAction(action) {
    setFriendBusy(true)
    try {
      const profileId = profile?.user_id
      if (!profileId) throw new Error('Profile is not available')
      if (action === 'request') {
        await api(`/api/friend-requests/${profileId}`, { method: 'POST', body: '{}' })
      } else if (action === 'cancel') {
        await api(`/api/friend-requests/${profile.friend_request_id}/cancel`, { method: 'DELETE' })
      } else if (action === 'accept') {
        await api(`/api/friend-requests/${profile.friend_request_id}/accept`, { method: 'POST', body: '{}' })
      } else if (action === 'decline') {
        await api(`/api/friend-requests/${profile.friend_request_id}/decline`, { method: 'DELETE' })
      } else if (action === 'unfriend') {
        await api(`/api/friends/${profileId}/unfriend`, { method: 'DELETE' })
      }
      load()
    } catch (err) { setError(err.message) } finally { setFriendBusy(false) }
  }

  return (
    <section className="narrow-page">
      {error && <div className="alert" role="alert">{error}</div>}
      {profile && (
        <section className="card profile-header">
          <div className="avatar profile-avatar">{(profile.avatarUrl || profile.avatar_url) ? <img src={profile.avatarUrl || profile.avatar_url} alt="" /> : (profile.displayName || profile.display_name || username).slice(0, 1).toUpperCase()}</div>
          <div className="profile-info">
            <h1>{profile.displayName || profile.display_name || username}</h1>
            <p>@{profile.username || username}</p>
            {profile.bio && <p>{profile.bio}</p>}
            {profile.joinedAt || profile.created_at ? <small>Joined {new Date(profile.joinedAt || profile.created_at).toLocaleDateString()}</small> : null}
          </div>
          {isOwner ? (
            <a className="button secondary" href="/settings">Edit profile</a>
          ) : (() => {
            const status = profile.friendshipStatus || profile.friendship_status || 'none'
            if (status === 'friend') {
              return <button className="primary" disabled={friendBusy} onClick={() => friendAction('unfriend')}>Remove</button>
            }
            if (status === 'requested') {
              return <button className="primary" disabled={friendBusy} onClick={() => friendAction('cancel')}>Requested</button>
            }
            if (status === 'incoming') {
              return (
                <div className="row-actions">
                  <button className="primary" disabled={friendBusy} onClick={() => friendAction('accept')}>Accept</button>
                  <button disabled={friendBusy} onClick={() => friendAction('decline')}>Decline</button>
                </div>
              )
            }
            return <button className="primary" disabled={friendBusy} onClick={() => friendAction('request')}>Add friend</button>
          })()}
        </section>
      )}
      <h2>Posts</h2>
      {posts.length === 0 ? <div className="card empty-state"><p>No posts are available.</p></div> : posts.map(post => <PostCard key={post.id} post={post} onChanged={load} />)}
    </section>
  )
}
