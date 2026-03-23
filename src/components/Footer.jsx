import { useAuth } from '../context/AuthContext'
import './Footer.css'

export default function Footer() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <footer className="app-footer">
      <p>© {new Date().getFullYear()} SajiloKhet. All rights reserved.</p>
    </footer>
  )
}
