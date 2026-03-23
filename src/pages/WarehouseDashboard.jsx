import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import './Dashboard.css'

export default function WarehouseDashboard() {
  const { profile } = useAuth()
  const [inventory, setInventory] = useState([])
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [view, setView] = useState('inventory')
  const [form, setForm] = useState({ product_id: '', quantity: '', batch_number: '', expiry_date: '', storage_condition: 'Normal' })
  const [msg, setMsg] = useState('')

  useEffect(() => { fetchInventory(); fetchProducts(); fetchOrders() }, [])

  async function fetchInventory() {
    const { data } = await supabase.from('inventory').select('*, products(name, unit)').order('created_at', { ascending: false })
    setInventory(data || [])
  }
  async function fetchProducts() {
    const { data } = await supabase.from('products').select('id, name, unit')
    setProducts(data || [])
  }
  async function fetchOrders() {
    const { data, error } = await supabase.from('orders')
      .select('*, order_items(quantity, products(name)), deliveries(status)')
      .in('status', ['pending','assigned','confirmed'])
      .order('created_at', { ascending: true })
      
    if (error) { console.error("Error fetching orders:", error); setOrders([]); return }
    
    if (data && data.length > 0) {
      const pIds = [...new Set(data.map(o => o.consumer_id).filter(Boolean))]
      if (pIds.length > 0) {
        const { data: pData } = await supabase.from('profiles').select('id, name').in('id', pIds)
        const pMap = (pData || []).reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {})
        data.forEach(o => { o.profiles = { name: pMap[o.consumer_id] || 'Guest' } })
      }
    }
    setOrders(data || [])
  }

  async function addInventory(e) {
    e.preventDefault(); setMsg('')
    const { error } = await supabase.from('inventory').insert({
      product_id: parseInt(form.product_id), quantity: parseFloat(form.quantity),
      batch_number: form.batch_number || null, expiry_date: form.expiry_date || null,
      storage_condition: form.storage_condition
    })
    if (error) return setMsg('Error: ' + error.message)
    setMsg('✅ Inventory batch added!'); setForm({ product_id: '', quantity: '', batch_number: '', expiry_date: '', storage_condition: 'Normal' })
    fetchInventory()
  }

  async function updateOrderStatus(orderId, status) {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    if (status === 'dispatched') {
      await supabase.from('deliveries').insert({ order_id: orderId, status: 'assigned' })
    }
    fetchOrders()
  }

  const statusColor = {
    pending: '#f59e0b', assigned: '#3b82f6', out_of_stock: '#ef4444',
    confirmed: '#8b5cf6', out_for_delivery: '#06b6d4', completed: '#4ade80',
    cancelled: '#ef4444', payment_failed: '#ef4444'
  }
  const nextStatus = { pending: 'assigned', assigned: 'confirmed' }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>🏭 Warehouse Dashboard</h1>
          <p className="dash-sub">Manage inventory and fulfill orders</p>
        </div>
        <div className="tab-group">
          <button className={view==='inventory'?'tab active':'tab'} onClick={()=>setView('inventory')}>Inventory</button>
          <button className={view==='orders'?'tab active':'tab'} onClick={()=>setView('orders')}>
            Orders {orders.length > 0 && <span className="badge">{orders.length}</span>}
          </button>
          <button className={view==='add'?'tab active':'tab'} onClick={()=>setView('add')}>+ Add Stock</button>
        </div>
      </div>
      {msg && <div className="dash-msg">{msg}</div>}

      {view === 'inventory' && (
        <div className="table-wrap">
          <table className="dash-table">
            <thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Batch</th><th>Expiry</th><th>Storage</th></tr></thead>
            <tbody>
              {inventory.map(i => (
                <tr key={i.id} className={i.expiry_date && new Date(i.expiry_date) < new Date(Date.now() + 7*86400000) ? 'row-warn' : ''}>
                  <td>{i.products?.name}</td>
                  <td>{i.quantity}</td>
                  <td>{i.products?.unit}</td>
                  <td>{i.batch_number || '—'}</td>
                  <td>{i.expiry_date ? new Date(i.expiry_date).toLocaleDateString() : '—'}</td>
                  <td><span className={`tag ${i.storage_condition === 'Cold' ? 'tag-blue' : 'tag-gray'}`}>{i.storage_condition}</span></td>
                </tr>
              ))}
              {inventory.length === 0 && <tr><td colSpan={6} className="empty-row">No inventory recorded yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {view === 'orders' && (
        <div className="orders-view">
          {orders.length === 0 ? <div className="empty-state">🎉 No pending orders!</div> :
          orders.map(o => (
            <div key={o.id} className="order-card">
              <div className="order-top">
                <span className="order-id">Order #{o.id}</span>
                <span className="order-status" style={{color: statusColor[o.status]}}>● {o.status}</span>
                <span className="order-date">Customer: {o.profiles?.name}</span>
              </div>
              <div className="order-items-list">
                {o.order_items?.map((i,idx) => <span key={idx}>{i.products?.name} × {i.quantity}</span>)}
              </div>
              {nextStatus[o.status] && (
                <button className="btn-status" onClick={() => updateOrderStatus(o.id, nextStatus[o.status])}>
                  Mark as {nextStatus[o.status]} →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {view === 'add' && (
        <div className="dash-card" style={{maxWidth: 480}}>
          <h2>Add Inventory Batch</h2>
          <form onSubmit={addInventory} className="auth-form">
            <div className="form-group">
              <label>Product</label>
              <select value={form.product_id} onChange={e => setForm(f => ({...f, product_id: e.target.value}))} required>
                <option value="">— Select Product —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity</label>
              <input type="number" min="0" step="0.1" value={form.quantity} onChange={e => setForm(f => ({...f, quantity: e.target.value}))} required placeholder="e.g. 50" />
            </div>
            <div className="form-group">
              <label>Batch Number (optional)</label>
              <input type="text" value={form.batch_number} onChange={e => setForm(f => ({...f, batch_number: e.target.value}))} placeholder="e.g. BATCH-2025-03" />
            </div>
            <div className="form-group">
              <label>Expiry Date (optional)</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({...f, expiry_date: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Storage Condition</label>
              <select value={form.storage_condition} onChange={e => setForm(f => ({...f, storage_condition: e.target.value}))}>
                <option>Normal</option>
                <option>Cold</option>
                <option>Dry</option>
              </select>
            </div>
            <button type="submit" className="auth-submit">Add to Inventory</button>
          </form>
        </div>
      )}
    </div>
  )
}
