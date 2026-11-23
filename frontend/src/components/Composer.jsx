import { useRef, useState } from 'react'
import { api } from '../api'

export default function Composer({ onCreated }) {
  const [content, setContent] = useState('')
  const [audience, setAudience] = useState('friends')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  function chooseFiles(event) {
    const selected = Array.from(event.target.files || []).slice(0, 4)
    setFiles(selected)
  }

  async function submit(event) {
    event.preventDefault()
    if (!content.trim() && files.length === 0) return
    setBusy(true)
    setError('')
    try {
      const audienceValue = audience === 'only_me' ? 'private' : audience
      const post = await api('/api/posts', {
        method: 'POST',
        body: JSON.stringify({ text: content.trim(), audience: audienceValue })
      })
      for (const file of files) {
        const form = new FormData()
        form.set('file', file)
        await api(`/api/posts/${post.id}/media`, { method: 'POST', body: form })
      }
      setContent('')
      setAudience('friends')
      setFiles([])
      if (inputRef.current) inputRef.current.value = ''
      onCreated?.()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <form className="card composer" onSubmit={submit}>
      <label htmlFor="post-content" className="sr-only">Post text</label>
      <textarea id="post-content" rows="3" placeholder="Share something…" value={content} onChange={e => setContent(e.target.value)} />
      {files.length > 0 && (
        <div className="preview-grid" aria-label="Selected images">
          {files.map(file => <img key={`${file.name}-${file.lastModified}`} src={URL.createObjectURL(file)} alt={`Preview of ${file.name}`} onLoad={e => URL.revokeObjectURL(e.currentTarget.src)} />)}
        </div>
      )}
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="composer-actions">
        <div>
          <input ref={inputRef} id="post-media" type="file" accept="image/*,video/*" multiple onChange={chooseFiles} />
          <label className="button secondary" htmlFor="post-media">Add media</label>
          <label className="audience-control">Audience
            <select value={audience} onChange={e => setAudience(e.target.value)}>
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="only_me">Only me</option>
            </select>
          </label>
        </div>
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Posting…' : 'Post'}</button>
      </div>
    </form>
  )
}
