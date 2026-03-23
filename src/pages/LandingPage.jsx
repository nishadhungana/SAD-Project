import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Landing.css'

export default function LandingPage() {
  const { profile } = useAuth()

  const dashRoute = profile ? {
    farmer: '/farmer', cooperative: '/cooperative', consumer: '/consumer',
    warehouse_staff: '/warehouse', delivery: '/delivery', admin: '/admin'
  }[profile.role] : null

  return (
    <div className="landing">
      <div className="hero-section">
        <div className="hero-badge">🌱 Nepal's Digital Farm Marketplace</div>
        <h1 className="hero-title">
          Farm Fresh,<br />
          <span className="gradient-text">Delivered Fresh</span>
        </h1>
        <p className="hero-subtitle">
          Connecting Nepal's farmers, cooperatives, and urban consumers through a centralized digital marketplace — cutting intermediaries, boosting farmer income, lowering consumer prices.
        </p>
        <div className="hero-actions">
          {dashRoute ? (
            <Link to={dashRoute} className="cta-primary">Go to Dashboard →</Link>
          ) : (
            <>
              <Link to="/consumer" className="cta-primary">Shop Now →</Link>
              <Link to="/register" className="cta-secondary">Join as Farmer</Link>
            </>
          )}
        </div>
        <div className="hero-stats">
          <div className="stat">
            <span className="stat-number">Rs 35</span>
            <span className="stat-label">Farmers earn /kg</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat">
            <span className="stat-number">Rs 60</span>
            <span className="stat-label">Consumers pay /kg</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat">
            <span className="stat-number">3x</span>
            <span className="stat-label">Less intermediaries</span>
          </div>
        </div>
      </div>

      <div className="supply-chain">
        <h2>How It Works</h2>
        <div className="chain-flow">
          {[
            { icon: '👨‍🌾', label: 'Farmer', desc: 'Reports harvest to cooperative' },
            { icon: '🤝', label: 'Cooperative', desc: 'Aggregates & coordinates supply' },
            { icon: '🏭', label: 'Warehouse', desc: 'Stores, inspects & manages stock' },
            { icon: '📦', label: 'Consumer', desc: 'Orders fresh produce online' },
          ].map((step, i) => (
            <div key={i} className="chain-step">
              <div className="chain-icon">{step.icon}</div>
              <div className="chain-label">{step.label}</div>
              <div className="chain-desc">{step.desc}</div>
              {i < 3 && <div className="chain-arrow">→</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="roles-section">
        <h2>Join as</h2>
        <div className="roles-grid">
          {[
            { icon: '👨‍🌾', title: 'Farmer', desc: 'Register your farm, report harvests, track earnings', role: 'farmer' },
            { icon: '🤝', title: 'Cooperative', desc: 'Manage members, coordinate supply, schedule pickups', role: 'cooperative' },
            { icon: '🛒', title: 'Consumer', desc: 'Browse fresh products, place orders, track delivery', role: 'consumer' },
            { icon: '🚚', title: 'Delivery', desc: 'Receive assignments, update delivery status', role: 'delivery' },
          ].map((r, i) => (
            <Link key={i} to={`/register?role=${r.role}`} className="role-card">
              <span className="role-icon">{r.icon}</span>
              <h3>{r.title}</h3>
              <p>{r.desc}</p>
              <span className="role-join">Register →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
