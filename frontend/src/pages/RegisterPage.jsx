import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register(form)
      navigate('/feed', { replace: true })
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function update(event) { setForm({ ...form, [event.target.name]: event.target.value }) }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="register-title">
        <h1 id="register-title">Create account</h1>
        <p>Join the conversation.</p>
        {error && <div className="alert" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label>Display name
            <input name="displayName" autoComplete="name" value={form.displayName} onChange={update} required />
          </label>
          <label>Username
            <input name="username" autoComplete="username" value={form.username} onChange={update} pattern="[A-Za-z0-9_]+" required />
          </label>
          <label>Email
            <input name="email" type="email" autoComplete="email" value={form.email} onChange={update} required />
          </label>
          <label>Password
            <input name="password" type="password" autoComplete="new-password" minLength="8" value={form.password} onChange={update} required />
          </label>
          <button className="primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        </form>
        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </section>
    </main>
  )
}
