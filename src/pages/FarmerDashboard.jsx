import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import './Dashboard.css'

const statusColor = {
  pending: '#f59e0b', assigned: '#3b82f6', out_of_stock: '#ef4444',
  confirmed: '#8b5cf6', out_for_delivery: '#06b6d4', completed: '#4ade80',
  cancelled: '#ef4444', payment_failed: '#ef4444'
}

export default function FarmerDashboard() {
  const { profile } = useAuth()
  const [farmerInfo, setFarmerInfo] = useState(null)
  const [cooperatives, setCooperatives] = useState([])
  const [assignedOrders, setAssignedOrders] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', farm_location: '', farm_size: '', cooperative_id: '' })
  const [harvestForm, setHarvestForm] = useState({ name: '', quantity: '', unit: 'kg', price: '', harvest_date: '', cooperative_id: '' })
  const [harvests, setHarvests] = useState([])
  const [msg, setMsg] = useState('')
  const [tab, setTab] = useState('profile')

  useEffect(() => { if (profile) { fetchFarmer(); fetchCooperatives(); fetchAssignedOrders(); fetchHarvests() } }, [profile])

  async function fetchFarmer() {
    const { data } = await supabase.from('farmers')
      .select('*, cooperatives(name, location)').eq('user_id', profile.id).maybeSingle()
    setFarmerInfo(data)
    if (data) setForm({ name: profile?.name || '', farm_location: data.farm_location, farm_size: data.farm_size || '', cooperative_id: data.cooperative_id || '' })
    else setForm(f => ({ ...f, name: profile?.name || '' }))
  }

  async function fetchCooperatives() {
    const { data } = await supabase.from('cooperatives').select('id, name, location')
    setCooperatives(data || [])
  }

  async function fetchAssignedOrders() {
    const { data, error } = await supabase.from('orders')
      .select('*, order_items(*, products(name))')
      .eq('assigned_to', profile.id)
      .in('status', ['assigned', 'confirmed', 'out_for_delivery', 'completed', 'out_of_stock'])
      .order('created_at', { ascending: false })
    if (error) console.error("Error fetching assigned orders:", error)
    setAssignedOrders(data || [])
  }

  async function fetchHarvests() {
    const { data } = await supabase.from('farmer_harvest_submissions')
      .select('*, cooperatives(name)')
      .eq('farmer_id', profile.id)
      .order('created_at', { ascending: false })
    setHarvests(data || [])
  }

  async function saveFarmer(e) {
    e.preventDefault(); setMsg('')
    
    // Attempt to update the user's name in `profiles` if it has changed
    if (form.name && form.name !== profile?.name) {
      const { error: nameErr } = await supabase.from('profiles').update({ name: form.name }).eq('id', profile.id)
      if (nameErr) return setMsg('Error updating name: ' + nameErr.message)
    }

    const payload = { user_id: profile.id, farm_location: form.farm_location, farm_size: parseFloat(form.farm_size) || null, cooperative_id: form.cooperative_id || null }
    if (farmerInfo) {
      const { error } = await supabase.from('farmers').update(payload).eq('user_id', profile.id)
      if (error) { setMsg('Error: ' + error.message); return }
    } else {
      const { error } = await supabase.from('farmers').insert(payload)
      if (error) { setMsg('Error: ' + error.message); return }
    }
    setMsg('✅ Farm profile saved!'); setEditing(false); fetchFarmer()
  }

  async function submitHarvest(e) {
    e.preventDefault(); setMsg('')
    const targetCoopId = farmerInfo?.cooperative_id
    if (!targetCoopId) return setMsg('Please join a cooperative first in your Profile tab.')
    
    const { error } = await supabase.from('farmer_harvest_submissions').insert({
      farmer_id: profile.id,
      cooperative_id: targetCoopId,
      product_name: harvestForm.name,
      quantity: parseFloat(harvestForm.quantity),
      unit: harvestForm.unit,
      expected_price: harvestForm.price ? parseFloat(harvestForm.price) : null,
      harvest_date: harvestForm.harvest_date
    })
    
    if (error) return setMsg('Error: ' + error.message)
    setMsg('✅ Harvest submitted to Cooperative for review!')
    setHarvestForm({ name: '', quantity: '', unit: 'kg', price: '', harvest_date: '', cooperative_id: harvestForm.cooperative_id })
    fetchHarvests()
  }

  async function confirmOrder(orderId) {
    setMsg('')
    const { error } = await supabase.from('orders').update({ status: 'confirmed' }).eq('id', orderId)
    if (error) return setMsg('Error: ' + error.message)
    setMsg('✅ Order confirmed! Waiting for delivery assignment.')
    fetchAssignedOrders()
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>👨‍🌾 Farmer Dashboard</h1>
          <p className="dash-sub">Welcome, {profile?.name}</p>
        </div>
        <div className="tab-group">
          <button className={tab === 'profile' ? 'tab active' : 'tab'} onClick={() => setTab('profile')}>Profile</button>
          <button className={tab === 'harvest' ? 'tab active' : 'tab'} onClick={() => setTab('harvest')}>Upcoming Harvest</button>
        </div>
      </div>
      {msg && <div className="dash-msg">{msg}</div>}

      {tab === 'profile' && (
        <div className="dashboard-grid">
          <div className="dash-card">
            <h2>Farm Profile</h2>
            {!editing && farmerInfo ? (
              <div className="info-block">
                <div className="info-row"><span>📍 Location</span><strong>{farmerInfo.farm_location}</strong></div>
                <div className="info-row"><span>📐 Farm Size</span><strong>{farmerInfo.farm_size ? `${farmerInfo.farm_size} sq m` : 'Not set'}</strong></div>
                <div className="info-row"><span>🤝 Cooperative</span><strong>{farmerInfo.cooperatives?.name || 'Not joined'}</strong></div>
                {farmerInfo.cooperatives && <div className="info-row"><span>📍 Coop Location</span><strong>{farmerInfo.cooperatives.location}</strong></div>}
                <button className="btn-edit" onClick={() => setEditing(true)}>Edit Profile</button>
              </div>
            ) : (
              <form onSubmit={saveFarmer} className="auth-form">
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    placeholder="e.g. Ram Bahadur" required />
                </div>
                <div className="form-group">
                  <label>Farm Location</label>
                  <input type="text" value={form.farm_location} onChange={e => setForm(f => ({...f, farm_location: e.target.value}))}
                    placeholder="e.g. Kavre, Bagmati Province" required />
                </div>
                <div className="form-group">
                  <label>Farm Size (sq meters)</label>
                  <input type="number" value={form.farm_size} onChange={e => setForm(f => ({...f, farm_size: e.target.value}))}
                    placeholder="e.g. 5000" />
                </div>
                <div className="form-group">
                  <label>Join a Cooperative</label>
                  <select value={form.cooperative_id} onChange={e => setForm(f => ({...f, cooperative_id: e.target.value}))}>
                    <option value="">— None —</option>
                    {cooperatives.map(c => <option key={c.id} value={c.id}>{c.name} ({c.location})</option>)}
                  </select>
                </div>
                <div style={{display:'flex',gap:'0.75rem'}}>
                  <button type="submit" className="auth-submit" style={{flex:1}}>Save</button>
                  {farmerInfo && <button type="button" className="btn-edit" onClick={() => setEditing(false)}>Cancel</button>}
                </div>
              </form>
            )}
            {!farmerInfo && !editing && (
              <button className="auth-submit" style={{marginTop:'1rem'}} onClick={() => setEditing(true)}>Set Up Farm Profile</button>
            )}
          </div>

          <div className="dash-card">
            <h2>📊 Quick Stats</h2>
            <div className="stats-block">
              <div className="stat-item">
                <span className="si-label">Status</span>
                <span className="si-val" style={{color: farmerInfo ? '#4ade80' : '#f59e0b'}}>
                  {farmerInfo ? '✅ Registered' : '⚠️ Not registered'}
                </span>
              </div>
              <div className="stat-item">
                <span className="si-label">Cooperative</span>
                <span className="si-val">{farmerInfo?.cooperatives?.name || 'Independent'}</span>
              </div>
              <div className="stat-item">
                <span className="si-label">Assigned Orders</span>
                <span className="si-val">{assignedOrders.length}</span>
              </div>
            </div>
            <div className="dash-info-box">
              <h4>🌱 How to Earn More</h4>
              <ul>
                <li>Join a cooperative to access bulk pricing</li>
                <li>Report your harvest estimates on time</li>
                <li>SajiloKhet pays up to Rs 35–40/kg directly to cooperatives</li>
              </ul>
            </div>
          </div>
        </div>
      )}



      {tab === 'harvest' && (
        <div className="dashboard-grid">
          <div className="dash-card">
            <h2>🚜 Submit Harvest to Cooperative</h2>
            <form onSubmit={submitHarvest} className="auth-form">
              <div className="form-group"><label>Product Name</label><input type="text" value={harvestForm.name} required onChange={e => setHarvestForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Fresh Tomatoes" /></div>
              
              <div style={{display:'flex', gap:'1rem'}}>
                <div className="form-group" style={{flex:2}}><label>Quantity</label><input type="number" min="0" step="0.1" value={harvestForm.quantity} required onChange={e => setHarvestForm(p => ({ ...p, quantity: e.target.value }))} placeholder="e.g. 50" /></div>
                <div className="form-group" style={{flex:1}}>
                  <label>Unit</label>
                  <select value={harvestForm.unit} onChange={e => setHarvestForm(p => ({ ...p, unit: e.target.value }))}>
                    <option>kg</option><option>ton</option><option>piece</option><option>bundle</option>
                  </select>
                </div>
              </div>

              <div className="form-group"><label>Expected Price (Rs) <span style={{fontWeight:'normal', fontSize:'0.8rem'}}>(Optional)</span></label><input type="number" min="0" step="0.5" value={harvestForm.price} onChange={e => setHarvestForm(p => ({ ...p, price: e.target.value }))} placeholder="e.g. 60" /></div>
              
              <div className="form-group"><label>Harvest Date</label><input type="date" value={harvestForm.harvest_date} required onChange={e => setHarvestForm(p => ({ ...p, harvest_date: e.target.value }))} /></div>

              <div className="form-group">
                <label>Submit to Cooperative</label>
                <div style={{padding:'0.6rem', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', color:'var(--text-muted)'}}>
                  {farmerInfo?.cooperatives?.name || '🚫 Not joined any Cooperative yet. Please join one in the Profile tab.'}
                </div>
              </div>

              <button type="submit" className="btn-edit" style={{background: '#4ade80', color: '#0f172a', fontWeight: 'bold'}}>Submit Harvest</button>
            </form>
          </div>

          <div className="dash-card">
            <h2>📋 Your Submissions</h2>
            {harvests.length === 0 ? (
              <div className="empty-state-sm">No harvest submissions yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="dash-table">
                  <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Cooperative</th><th>Status</th></tr></thead>
                  <tbody>
                    {harvests.map(h => (
                      <tr key={h.id}>
                        <td style={{fontSize:'0.85rem'}}>{new Date(h.harvest_date).toLocaleDateString()}</td>
                        <td>{h.product_name}</td>
                        <td>{h.quantity} {h.unit}</td>
                        <td style={{fontSize:'0.85rem'}}>{h.cooperatives?.name}</td>
                        <td>
                          <span style={{color: h.status === 'accepted' ? '#4ade80' : h.status === 'rejected' ? '#ef4444' : '#f59e0b', fontWeight:600}}>
                            {h.status.charAt(0).toUpperCase() + h.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
