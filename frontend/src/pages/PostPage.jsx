import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import PostCard from '../components/PostCard'

export default function PostPage() {
  const { postId } = useParams()
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  function load() {
    Promise.all([api(`/api/posts/${postId}`), api(`/api/posts/${postId}/comments`)])
      .then(([postData, commentData]) => {
        setPost(postData.post || postData)
        setComments(Array.isArray(commentData) ? commentData : commentData.items || commentData.results || [])
      })
      .catch(err => setError(err.message))
  }

  useEffect(() => { load(); const refresh = () => load(); window.addEventListener('social-live', refresh); return () => window.removeEventListener('social-live', refresh) }, [postId])

  async function submit(event) {
    event.preventDefault()
    if (!text.trim()) return
    try {
      await api(`/api/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text: text.trim() }) })
      setText('')
      load()
    } catch (err) { setError(err.message) }
  }

  async function removeComment(id) {
    try { await api(`/api/posts/comments/${id}`, { method: 'DELETE' }); load() } catch (err) { setError(err.message) }
  }

  return (
    <section className="narrow-page">
      <h1>Post</h1>
      {error && <div className="alert" role="alert">{error}</div>}
      {post && <PostCard post={post} onChanged={load} />}
      <section className="card comments" aria-labelledby="comments-title">
        <h2 id="comments-title">Comments</h2>
        <form onSubmit={submit} className="comment-form">
          <label htmlFor="comment">Add a comment</label>
          <div><input id="comment" value={text} onChange={e => setText(e.target.value)} /><button className="primary" type="submit">Post</button></div>
        </form>
        {comments.length === 0 ? <p>No comments yet.</p> : comments.map(comment => (
          <article className="comment" key={comment.id}>
            <strong>{comment.author?.displayName || comment.author?.display_name || comment.author?.username || comment.display_name || comment.username || 'User'}</strong>
            <p>{comment.content || comment.text}</p>
            <button className="text-button" onClick={() => removeComment(comment.id)}>Delete</button>
          </article>
        ))}
      </section>
    </section>
  )
}
