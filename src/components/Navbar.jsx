import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const dashboardLink = () => {
    if (!user) return '/login'
    const role = profile?.role || user.user_metadata?.role || 'consumer'
    const routes = {
      farmer: '/farmer',
      cooperative: '/cooperative',
      consumer: '/consumer',
      warehouse_staff: '/warehouse',
      delivery: '/delivery',
      admin: '/admin',
    }
    return routes[role] || '/'
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="brand-icon">🌾</span>
        SajiloKhet
      </Link>
      <div className="navbar-links">
        <Link to="/consumer" className="nav-link">Shop</Link>
        {user ? (
          <div className="nav-user">
            {profile?.role === 'admin' && (
              <Link to="/admin" className="nav-link" style={{color:'#fca5a5', fontWeight:700}}>
                🛡️ Admin Panel
              </Link>
            )}
            <Link to={dashboardLink()} className="nav-link dashboard-link">
              {profile?.name || 'Dashboard'}
            </Link>
            <button onClick={async () => { await signOut(); navigate('/'); }} className="btn-logout">Sign Out</button>
          </div>
        ) : (
          <div className="nav-auth">
            <Link to="/login" className="btn-outline">Login</Link>
            <Link to="/register" className="btn-primary">Register</Link>
            <Link to="/admin-login" className="nav-link" style={{fontSize:'0.78rem', color:'#6b7280', marginLeft:'0.25rem'}} title="Admin Access">🛡️</Link>
          </div>
        )}
      </div>
    </nav>
  )
}

