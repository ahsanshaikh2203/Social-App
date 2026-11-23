import { useCallback, useEffect, useState } from 'react'
import { api, unwrapList } from '../api'
import Composer from '../components/Composer'
import PostCard from '../components/PostCard'

export default function FeedPage() {
  const [posts, setPosts] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api('/api/posts/feed').then(data => setPosts(unwrapList(data, 'posts'))).catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const refresh = event => {
      if (event.detail?.type === 'post') load()
    }
    window.addEventListener('social-live', refresh)
    return () => window.removeEventListener('social-live', refresh)
  }, [load])

  return (
    <section className="feed">
      <h1>Home</h1>
      <Composer onCreated={load} />
      {error && <div className="alert" role="alert">{error}</div>}
      {loading ? <p role="status">Loading feed…</p> : posts.length === 0 ? (
        <div className="card empty-state"><h2>Your feed is quiet</h2><p>Follow friends or create the first post.</p></div>
      ) : posts.map(post => <PostCard key={post.id} post={post} onChanged={load} />)}
    </section>
  )
}
