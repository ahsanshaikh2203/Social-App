import { createContext, useContext, useEffect, useState } from 'react'
import { api, resetCsrf } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  async function login(credentials) {
    resetCsrf()
    const next = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) })
    setUser(next.user || next)
    return next
  }

  async function register(details) {
    resetCsrf()
    const next = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(details) })
    setUser(next.user || next)
    return next
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST', body: '{}' })
    resetCsrf()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
