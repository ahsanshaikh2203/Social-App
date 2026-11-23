import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

export default function PostCard({ post, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const author = post.author || post.user || {}
  const username = author.username || post.username || 'user'
  const displayName = author.displayName || author.display_name || username
  const liked = post.liked || post.viewerLiked || post.viewer_liked || false
  const media = post.media || post.images || []
  const content = post.content || post.text || ''
  const likeCount = post.likeCount ?? post.like_count ?? post.likesCount ?? post.likes_count ?? post.likes ?? 0
  const commentCount = post.commentCount ?? post.comment_count ?? post.commentsCount ?? post.comments_count ?? 0

  async function toggleLike() {
    setBusy(true)
    setError('')
    try {
      await api(`/api/posts/${post.id}/like`, { method: liked ? 'DELETE' : 'POST', body: '{}' })
      onChanged?.()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <article className="card post-card" aria-label={`Post by ${displayName}`}>
      <header className="post-header">
        <Link className="avatar small" to={`/profile/${username}`} aria-label={`${displayName}'s profile`}>
          {(author.avatarUrl || author.avatar_url) ? <img src={author.avatarUrl || author.avatar_url} alt="" /> : displayName.slice(0, 1).toUpperCase()}
        </Link>
        <div>
          <Link className="author" to={`/profile/${username}`}>{displayName}</Link>
          <time dateTime={post.createdAt || post.created_at}>{formatDate(post.createdAt || post.created_at)}</time>
        </div>
      </header>
      {content && <p className="post-content">{content}</p>}
      {media.length > 0 && (
        <div className={`media-grid media-${Math.min(media.length, 4)}`}>
          {media.map((item, index) => {
            const src = typeof item === 'string' ? item : item.url
            return <img key={item.id || src || index} src={src} alt={typeof item === 'object' ? item.alt || '' : ''} loading="lazy" />
          })}
        </div>
      )}
      {error && <div className="alert" role="alert">{error}</div>}
      <footer className="post-actions">
        <button className={liked ? 'active' : ''} onClick={toggleLike} disabled={busy} aria-pressed={liked}>
          ♡ <span>{likeCount}</span>
          <span className="sr-only"> likes</span>
        </button>
        <Link to={`/posts/${post.id}`}>◯ <span>{commentCount}</span><span className="sr-only"> comments</span></Link>
      </footer>
    </article>
  )
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
