import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

const ROLES = [
  { value: 'consumer', label: '🛒 Consumer' },
  { value: 'farmer', label: '👨‍🌾 Farmer' },
  { value: 'cooperative', label: '🤝 Cooperative' },
  { value: 'delivery', label: '🚚 Delivery Personnel' },
]

export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    role: searchParams.get('role') || 'consumer'
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    const { error } = await signUp(form.email, form.password, form.name, form.role)
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess('Account created! Please check your email to confirm, then log in.')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🌾</div>
          <h1>Create Account</h1>
          <p>Join Nepal's digital farm marketplace</p>
        </div>
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}
        {!success && (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input id="name" name="name" type="text" value={form.name}
                onChange={handleChange} placeholder="Ram Bahadur" required />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" value={form.email}
                onChange={handleChange} placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label htmlFor="role">I am a</label>
              <select id="role" name="role" value={form.role} onChange={handleChange}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" value={form.password}
                onChange={handleChange} placeholder="Min 6 characters" required />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" value={form.confirmPassword}
                onChange={handleChange} placeholder="••••••••" required />
            </div>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}
        {success && <Link to="/login" className="auth-submit" style={{textAlign:'center',display:'block'}}>Go to Login</Link>}
        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
