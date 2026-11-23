import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(form)
      navigate(location.state?.from?.pathname || '/feed', { replace: true })
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <h1 id="login-title">Welcome back</h1>
        <p>Sign in to your Social account.</p>
        {error && <div className="alert" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label>Username or email
            <input name="username" autoComplete="username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
          </label>
          <label>Password
            <input name="password" type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </label>
          <button className="primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="auth-switch">New here? <Link to="/register">Create an account</Link></p>
      </section>
    </main>
  )
}
