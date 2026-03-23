import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AdminLogin.css'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: signInError } = await signIn(email, password)
    setLoading(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    // Wait a moment for profile to load then check role
    // We'll redirect and let ProtectedRoute handle role enforcement
    navigate('/admin')
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-header">
          <span className="admin-shield">🛡️</span>
          <h1>Admin Access</h1>
          <p>SajiloKhet Control Panel</p>
          <span className="admin-badge">Restricted Access</span>
        </div>

        {error && <div className="admin-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-group">
            <label htmlFor="admin-email">Admin Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@sajilokhet.com"
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="admin-submit" disabled={loading}>
            {loading ? 'Authenticating...' : '🔐 Sign In as Admin'}
          </button>
        </form>

        <p className="admin-footer">
          Not an admin? <Link to="/login">Regular Login →</Link>
        </p>
      </div>
    </div>
  )
}
