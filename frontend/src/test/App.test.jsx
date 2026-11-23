import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'

vi.mock('../auth', async () => {
  const React = await import('react')
  return {
    AuthProvider: ({ children }) => children,
    useAuth: () => ({ user: null, loading: false, logout: vi.fn(), setUser: vi.fn() })
  }
})

describe('authentication routes', () => {
  it('shows login form', () => {
    window.history.pushState({}, '', '/login')
    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /welcome back/i })).not.toBeNull()
  })
})
