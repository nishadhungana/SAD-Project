import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import './Dashboard.css'

const statusColor = {
  pending: '#f59e0b', assigned: '#3b82f6', out_of_stock: '#ef4444',
  confirmed: '#8b5cf6', out_for_delivery: '#06b6d4', completed: '#4ade80',
  cancelled: '#ef4444', payment_failed: '#ef4444'
}

export default function CooperativeDashboard() {
  const { profile } = useAuth()
  const [coop, setCoop] = useState(null)
  const [farmers, setFarmers] = useState([])
  const [harvests, setHarvests] = useState([])
  const [inventory, setInventory] = useState([])
  const [dispatchItems, setDispatchItems] = useState([])
  const [form, setForm] = useState({ name: '', location: '' })
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState('')
  const [tab, setTab] = useState('profile')

  useEffect(() => { if (profile) fetchCoop() }, [profile])

  async function fetchCoop() {
    const { data } = await supabase.from('cooperatives').select('*').eq('manager_id', profile.id).maybeSingle()
    setCoop(data)
    if (data) { 
      setForm({ name: data.name, location: data.location })
      fetchFarmers(data.id)
      fetchHarvests(data.id)
      fetchInventory(data.id)
    }
  }

  async function fetchFarmers(coopId) {
    const { data } = await supabase.from('farmers').select('*, profiles(name, email, phone)').eq('cooperative_id', coopId)
    setFarmers(data || [])
  }

  async function fetchHarvests(coopId) {
    const { data } = await supabase.from('farmer_harvest_submissions')
      .select('*, profiles(name)')
      .eq('cooperative_id', coopId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setHarvests(data || [])
  }

  async function fetchInventory(coopId) {
    const { data } = await supabase.from('cooperative_inventory')
      .select('*')
      .eq('cooperative_id', coopId)
      .gt('quantity', 0)
    setInventory(data || [])
  }

  async function saveCoop(e) {
    e.preventDefault(); setMsg('')
    if (coop) {
      const { error } = await supabase.from('cooperatives').update({ ...form }).eq('id', coop.id)
      if (error) return setMsg('Error: ' + error.message)
    } else {
      const { error } = await supabase.from('cooperatives').insert({ ...form, manager_id: profile.id })
      if (error) return setMsg('Error: ' + error.message)
    }
    setMsg('✅ Cooperative saved!'); setEditing(false); fetchCoop()
  }

  async function handleHarvest(harvest, status) {
    setMsg('')
    const { error } = await supabase.from('farmer_harvest_submissions').update({ status }).eq('id', harvest.id)
    if (error) return setMsg('Error: ' + error.message)
    
    if (status === 'accepted') {
      const { data: existing } = await supabase.from('cooperative_inventory')
        .select('*').eq('cooperative_id', coop.id).eq('product_name', harvest.product_name).maybeSingle()
        
      if (existing) {
        await supabase.from('cooperative_inventory').update({ quantity: Number(existing.quantity) + Number(harvest.quantity) }).eq('id', existing.id)
      } else {
        await supabase.from('cooperative_inventory').insert({
          cooperative_id: coop.id,
          product_name: harvest.product_name,
          quantity: harvest.quantity,
          unit: harvest.unit,
          price_paid: harvest.expected_price
        })
      }
    }
    setMsg(status === 'accepted' ? '✅ Harvest Accepted!' : '🚫 Harvest Rejected')
    fetchHarvests(coop.id)
    fetchInventory(coop.id)
  }

  async function createDispatch() {
    setMsg('')
    if (dispatchItems.length === 0) return setMsg('Select at least one item to dispatch.')
    
    const { data: order, error: orderErr } = await supabase.from('cooperative_dispatch_orders')
      .insert({ cooperative_id: coop.id, status: 'pending' })
      .select().single()
      
    if (orderErr) return setMsg('Error: ' + orderErr.message)
    
    for (const item of dispatchItems) {
      await supabase.from('cooperative_dispatch_items').insert({
        dispatch_order_id: order.id,
        product_name: item.product_name,
        quantity: item.dispatch_quantity,
        unit: item.unit,
        expected_price: item.price_paid
      })
      const newQty = Number(item.quantity) - Number(item.dispatch_quantity)
      await supabase.from('cooperative_inventory').update({ quantity: newQty }).eq('id', item.id)
    }
    
    setMsg('✅ Dispatch sent to Admin/Warehouse successfully!')
    setDispatchItems([])
    fetchInventory(coop.id)
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>🤝 Cooperative Dashboard</h1>
          <p className="dash-sub">Manage your member farmers and supply coordination</p>
        </div>
        <div className="tab-group">
          <button className={tab === 'profile' ? 'tab active' : 'tab'} onClick={() => setTab('profile')}>Profile & Farmers</button>
          <button className={tab === 'harvests' ? 'tab active' : 'tab'} onClick={() => setTab('harvests')}>
            Pending Harvests {harvests.length > 0 && <span className="badge">{harvests.length}</span>}
          </button>
          <button className={tab === 'inventory' ? 'tab active' : 'tab'} onClick={() => setTab('inventory')}>Inventory & Dispatch</button>
        </div>
      </div>
      {msg && <div className="dash-msg">{msg}</div>}

      {tab === 'profile' && (
        <div className="dashboard-grid">
          <div className="dash-card">
            <h2>Cooperative Profile</h2>
            {!editing && coop ? (
              <div className="info-block">
                <div className="info-row"><span>🏢 Name</span><strong>{coop.name}</strong></div>
                <div className="info-row"><span>📍 Location</span><strong>{coop.location}</strong></div>
                <div className="info-row"><span>👨‍🌾 Members</span><strong>{farmers.length} farmers</strong></div>
                <button className="btn-edit" onClick={() => setEditing(true)}>Edit</button>
              </div>
            ) : (
              <form onSubmit={saveCoop} className="auth-form">
                <div className="form-group">
                  <label>Cooperative Name</label>
                  <input type="text" value={form.name} required
                    onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    placeholder="e.g. Kavre Agro Cooperative" />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input type="text" value={form.location} required
                    onChange={e => setForm(f => ({...f, location: e.target.value}))}
                    placeholder="e.g. Panauti, Kavre" />
                </div>
                <button type="submit" className="auth-submit">Save</button>
                {coop && <button type="button" className="btn-edit" style={{marginTop:'0.5rem'}} onClick={() => setEditing(false)}>Cancel</button>}
              </form>
            )}
            {!coop && !editing && (
              <button className="auth-submit" style={{marginTop:'1rem'}} onClick={() => setEditing(true)}>Register Cooperative</button>
            )}
          </div>

          <div className="dash-card">
            <h2>👨‍🌾 Member Farmers ({farmers.length})</h2>
            {farmers.length === 0 ? (
              <div className="empty-state-sm">No farmers have joined yet.<br />Share your cooperative ID with farmers to join.</div>
            ) : (
              <div className="table-wrap">
                <table className="dash-table">
                  <thead><tr><th>Name</th><th>Location</th><th>Farm Size</th></tr></thead>
                  <tbody>
                    {farmers.map(f => (
                      <tr key={f.id}>
                        <td>{f.profiles?.name}</td>
                        <td>{f.farm_location}</td>
                        <td>{f.farm_size ? `${f.farm_size} sq m` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'harvests' && (
        <div className="dash-card">
          <h2>🌾 Pending Harvest Submissions</h2>
          {harvests.length === 0 ? (
            <div className="empty-state-sm">No pending harvests from your farmers.</div>
          ) : (
            <div className="table-wrap">
              <table className="dash-table">
                <thead><tr><th>Harvest Date</th><th>Farmer</th><th>Product</th><th>Qty</th><th>Price Expected</th><th>Actions</th></tr></thead>
                <tbody>
                  {harvests.map(h => (
                    <tr key={h.id}>
                      <td style={{fontSize:'0.85rem'}}>{new Date(h.harvest_date).toLocaleDateString()}</td>
                      <td>{h.profiles?.name}</td>
                      <td><strong>{h.product_name}</strong></td>
                      <td>{h.quantity} {h.unit}</td>
                      <td>{h.expected_price ? `Rs ${h.expected_price}` : '—'}</td>
                      <td>
                        <div style={{display:'flex', gap:'0.5rem'}}>
                          <button className="btn-sm" style={{background:'#4ade80', color:'#0f172a', fontWeight:600}} onClick={() => handleHarvest(h, 'accepted')}>Accept</button>
                          <button className="btn-sm" style={{background:'#fee2e2', color:'#ef4444', border:'1px solid #fca5a5'}} onClick={() => handleHarvest(h, 'rejected')}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'inventory' && (
        <div className="dashboard-grid">
          <div className="dash-card">
            <h2>📦 Cooperative Inventory (Confirmed)</h2>
            {inventory.length === 0 ? (
              <div className="empty-state-sm">No inventory available. Accept harvests first.</div>
            ) : (
              <div className="table-wrap">
                <table className="dash-table">
                  <thead><tr><th>Product</th><th>Available Qty</th><th>Avg Price</th><th>Add to Dispatch</th></tr></thead>
                  <tbody>
                    {inventory.map(inv => {
                      const alreadyInDispatch = dispatchItems.find(d => d.id === inv.id)
                      return (
                        <tr key={inv.id}>
                          <td><strong>{inv.product_name}</strong></td>
                          <td>{inv.quantity} {inv.unit}</td>
                          <td>{inv.price_paid ? `Rs ${inv.price_paid}` : '—'}</td>
                          <td>
                            {!alreadyInDispatch ? (
                              <button className="btn-sm" onClick={() => setDispatchItems([...dispatchItems, { ...inv, dispatch_quantity: inv.quantity }])}>+ Dispatch</button>
                            ) : (
                              <span style={{fontSize:'0.8rem', color:'#4ade80', fontWeight:600}}>Added</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="dash-card" style={{borderColor: dispatchItems.length > 0 ? '#3b82f6' : 'var(--border)'}}>
            <h2>🚚 Prepare Dispatch Order</h2>
            {dispatchItems.length === 0 ? (
              <div className="empty-state-sm" style={{color:'var(--text-muted)'}}>Select items from inventory to prepare a dispatch to the SajiloKhet Warehouse.</div>
            ) : (
              <div>
                {dispatchItems.map((item, idx) => (
                  <div key={item.id} style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center'}}>
                    <span style={{flex:1, fontSize:'0.9rem'}}><strong>{item.product_name}</strong> (Max: {item.quantity})</span>
                    <input type="number" max={item.quantity} min="0.1" step="0.1" value={item.dispatch_quantity} 
                      onChange={e => {
                        let newArr = [...dispatchItems]
                        newArr[idx].dispatch_quantity = e.target.value
                        setDispatchItems(newArr)
                      }} 
                      style={{width:'80px', padding:'0.2rem 0.5rem', borderRadius:'4px', border:'1px solid var(--border)', background:'var(--bg)'}} />
                    <span style={{fontSize:'0.85rem'}}>{item.unit}</span>
                    <button className="btn-sm" style={{background:'transparent', color:'#ef4444', padding:'0 0.2rem'}} 
                      onClick={() => setDispatchItems(dispatchItems.filter(d => d.id !== item.id))}>❌</button>
                  </div>
                ))}
                
                <button className="auth-submit" style={{marginTop:'1rem', background:'#3b82f6'}} onClick={createDispatch}>
                  🚀 Send Dispatch to Admin
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
