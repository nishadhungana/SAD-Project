import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ConsumerStorefront from './pages/ConsumerStorefront'
import FarmerDashboard from './pages/FarmerDashboard'
import CooperativeDashboard from './pages/CooperativeDashboard'
import WarehouseDashboard from './pages/WarehouseDashboard'
import DeliveryDashboard from './pages/DeliveryDashboard'
import AdminPanel from './pages/AdminPanel'
import AdminLoginPage from './pages/AdminLoginPage'

function RoleRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (!profile) return <Navigate to="/login" replace />
  const routes = { farmer:'/farmer', cooperative:'/cooperative', consumer:'/consumer', warehouse_staff:'/warehouse', delivery:'/delivery', admin:'/admin' }
  return <Navigate to={routes[profile.role] || '/'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin-login" element={<AdminLoginPage />} />
          <Route path="/consumer" element={<ConsumerStorefront />} />
          <Route path="/dashboard" element={<RoleRedirect />} />
          <Route path="/farmer" element={
            <ProtectedRoute allowedRoles={['farmer', 'admin']}>
              <FarmerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/cooperative" element={
            <ProtectedRoute allowedRoles={['cooperative', 'admin']}>
              <CooperativeDashboard />
            </ProtectedRoute>
          } />
          <Route path="/warehouse" element={
            <ProtectedRoute allowedRoles={['warehouse_staff', 'admin']}>
              <WarehouseDashboard />
            </ProtectedRoute>
          } />
          <Route path="/delivery" element={
            <ProtectedRoute allowedRoles={['delivery', 'admin']}>
              <DeliveryDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPanel />
            </ProtectedRoute>
          } />
          <Route path="/unauthorized" element={
            <div style={{textAlign:'center',padding:'4rem',color: 'var(--text-muted)'}}>
              <h2 style={{color:'#f87171'}}>⛔ Access Denied</h2>
              <p>You don't have permission to view this page.</p>
            </div>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </AuthProvider>
    </BrowserRouter>
  )
}
