import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Shell from './components/Shell'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import FeedPage from './pages/FeedPage'
import ProfilePage from './pages/ProfilePage'
import PostPage from './pages/PostPage'
import FriendsPage from './pages/FriendsPage'
import NotificationsPage from './pages/NotificationsPage'
import SearchPage from './pages/SearchPage'
import SettingsPage from './pages/SettingsPage'

function Protected({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main className="loading" role="status">Loading…</main>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <main className="loading" role="status">Loading…</main>
  return user ? <Navigate to="/feed" replace /> : children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route element={<Protected><Shell /></Protected>}>
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="/posts/:postId" element={<PostPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/feed" replace />} />
      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
