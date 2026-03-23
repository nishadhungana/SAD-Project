import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import './Dashboard.css'

const statusColor = { assigned:'#f59e0b', picked_up:'#3b82f6', on_the_way:'#8b5cf6', delivered:'#4ade80' }

export default function DeliveryDashboard() {
  const { profile } = useAuth()
  const [deliveries, setDeliveries] = useState([])
  const [msg, setMsg] = useState('')

  useEffect(() => { if (profile) fetchDeliveries() }, [profile])

  async function fetchDeliveries() {
    const { data } = await supabase.from('deliveries')
      .select('*, orders(total_amount, delivery_address, status)')
      .eq('delivery_staff_id', profile.id)
      .order('created_at', { ascending: false })
    setDeliveries(data || [])
  }

  async function updateStatus(id, newStatus) {
    setMsg('')
    const update = { status: newStatus }
    if (newStatus === 'delivered') update.delivered_at = new Date().toISOString()

    const { error } = await supabase.from('deliveries').update(update).eq('id', id)
    if (error) return setMsg('Error: ' + error.message)

    // Also update the order status
    const d = deliveries.find(d => d.id === id)
    if (d) {
      if (newStatus === 'picked_up') {
        await supabase.from('orders').update({ status: 'out_for_delivery' }).eq('id', d.order_id)
      } else if (newStatus === 'delivered') {
        await supabase.from('orders').update({ status: 'completed' }).eq('id', d.order_id)
      }
    }

    setMsg('✅ Status updated!'); fetchDeliveries()
  }

  const active = deliveries.filter(d => d.status !== 'delivered')
  const completed = deliveries.filter(d => d.status === 'delivered')

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>🚚 Delivery Dashboard</h1>
          <p className="dash-sub">Your deliveries, {profile?.name}</p>
        </div>
        <div className="tab-group">
          <span className="tag tag-blue" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            {active.length} Active
          </span>
          <span className="tag tag-green" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            {completed.length} Completed
          </span>
        </div>
      </div>
      {msg && <div className="dash-msg">{msg}</div>}

      {deliveries.length === 0 ? (
        <div className="empty-state">
          <span style={{fontSize:'3rem'}}>🚚</span>
          <p>No deliveries assigned to you yet.</p>
        </div>
      ) : (
        <div className="orders-view">
          {deliveries.map(d => (
            <div key={d.id} className="order-card">
              <div className="order-top">
                <span className="order-id">Delivery #{d.id}</span>
                <span className="order-status" style={{color: statusColor[d.status]}}>● {d.status.replace('_', ' ')}</span>
                <span className="order-date">Order #{d.order_id}</span>
              </div>
              <div className="order-bottom">
                <span>💰 Rs {d.orders?.total_amount}</span>
              </div>
              <div className="order-bottom" style={{marginTop:'0.25rem'}}>
                <span>📍 {d.orders?.delivery_address}</span>
              </div>

              {/* Status progression bar */}
              <div style={{ display: 'flex', gap: '0.25rem', margin: '0.75rem 0 0.5rem', alignItems: 'center' }}>
                {['assigned', 'picked_up', 'on_the_way', 'delivered'].map((s, i) => {
                  const steps = ['assigned', 'picked_up', 'on_the_way', 'delivered']
                  const currentIdx = steps.indexOf(d.status)
                  const active = i <= currentIdx
                  return (
                    <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                      <div style={{
                        width: '100%', height: 4, borderRadius: 2,
                        background: active ? statusColor[s] : 'var(--border)'
                      }} />
                      <span style={{ fontSize: '0.65rem', color: active ? statusColor[s] : 'var(--text-muted)' }}>
                        {s.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )
                })}
              </div>

              {d.status === 'assigned' && (
                <button className="btn-status" onClick={() => updateStatus(d.id, 'picked_up')}>
                  📦 Pick Up Order →
                </button>
              )}
              {d.status === 'picked_up' && (
                <button className="btn-status" onClick={() => updateStatus(d.id, 'on_the_way')} style={{ background: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.3)', color: '#8b5cf6' }}>
                  🛤️ Mark On the Way →
                </button>
              )}
              {d.status === 'on_the_way' && (
                <button className="btn-status green" onClick={() => updateStatus(d.id, 'delivered')}>
                  ✅ Mark as Delivered
                </button>
              )}
              {d.status === 'delivered' && (
                <div className="delivered-badge">✅ Delivered on {d.delivered_at ? new Date(d.delivered_at).toLocaleDateString() : '—'}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
