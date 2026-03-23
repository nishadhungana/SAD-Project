import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import './Dashboard.css'

const ALL_ROLES = ['consumer', 'farmer', 'cooperative', 'warehouse_staff', 'delivery', 'admin']
const statusColor = {
  pending: '#f59e0b', assigned: '#3b82f6', out_of_stock: '#ef4444',
  confirmed: '#8b5cf6', out_for_delivery: '#06b6d4', completed: '#4ade80',
  cancelled: '#ef4444', payment_failed: '#ef4444'
}

export default function AdminPanel() {
  const [users, setUsers] = useState([])
  const [products, setProducts] = useState([])
  const [inventory, setInventory] = useState([])
  const [orders, setOrders] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [cooperatives, setCooperatives] = useState([])
  const [dispatchOrders, setDispatchOrders] = useState([])
  const [warehouseInventory, setWarehouseInventory] = useState([])
  const [view, setView] = useState('overview')
  const [newProduct, setNewProduct] = useState({ warehouse_item_id: '', description: '', price: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [u, p, inv, o, d, c, d_o, w_i] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('id'),
      supabase.from('inventory').select('*'),
      supabase.from('orders').select('*, order_items(*, products(name))').order('created_at', { ascending: false }),
      supabase.from('deliveries').select('*, orders(delivery_address, total_amount)').order('created_at', { ascending: false }),
      supabase.from('cooperatives').select('*').order('id'),
      supabase.from('cooperative_dispatch_orders').select('*, cooperatives(name, location), cooperative_dispatch_items(*)').order('created_at', { ascending: false }),
      supabase.from('warehouse_inventory').select('*').order('created_at', { ascending: false }),
    ])
    setUsers(u.data || [])
    setProducts(p.data || [])
    setInventory(inv.data || [])
    setOrders(o.data || [])
    setDeliveries(d.data || [])
    setCooperatives(c.data || [])
    setDispatchOrders(d_o.data || [])
    setWarehouseInventory(w_i.data || [])
  }

  // ── PRODUCTS & WAREHOUSE ──
  async function addProduct(e) {
    e.preventDefault(); setMsg('')
    const wItem = warehouseInventory.find(w => w.id === Number(newProduct.warehouse_item_id))
    if (!wItem) return setMsg('Please select an item from the warehouse.')
    
    const { data: prod, error: pErr } = await supabase.from('products').insert({
      name: wItem.product_name,
      description: newProduct.description,
      unit: wItem.unit,
      price: parseFloat(newProduct.price),
      is_active: true
    }).select().single()
    if (pErr) return setMsg('Error: ' + pErr.message)
    
    await supabase.from('inventory').insert({
      product_id: prod.id,
      quantity: wItem.quantity,
      batch_number: 'WH-' + wItem.id
    })
    
    await supabase.from('warehouse_inventory').delete().eq('id', wItem.id)
    
    setMsg('✅ Product listed on Marketplace successfully!')
    setNewProduct({ warehouse_item_id: '', description: '', price: '' })
    fetchAll()
  }

  async function toggleProduct(id, active) {
    await supabase.from('products').update({ is_active: !active }).eq('id', id)
    fetchAll()
  }

  // ── USERS ──
  async function changeRole(userId, newRole) {
    setMsg('')
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (error) return setMsg('Error: ' + error.message)
    setMsg(`✅ Role updated to ${newRole}`)
    fetchAll()
  }

  async function deleteUser(userId, userName) {
    if (!window.confirm(`Delete user "${userName}"? This cannot be undone.`)) return
    setMsg('')
    const { error } = await supabase.from('profiles').delete().eq('id', userId)
    if (error) return setMsg('Error: ' + error.message)
    setMsg('✅ User deleted.')
    fetchAll()
  }

  // ── ORDER WORKFLOW ──

  // Check inventory for all items in an order
  function checkInventory(order) {
    for (const item of order.order_items || []) {
      const totalInv = inventory
        .filter(i => i.product_id === item.product_id)
        .reduce((s, i) => s + Number(i.quantity), 0)
      if (totalInv < item.quantity) return { ok: false, product: item.products?.name, need: item.quantity, have: totalInv }
    }
    return { ok: true }
  }

  async function dispatchToDelivery(orderId, staffId, order) {
    setMsg('')
    const check = checkInventory(order)
    if (!check.ok) {
      const { error } = await supabase.from('orders').update({ status: 'out_of_stock' }).eq('id', orderId)
      if (error) return setMsg(`❌ Database Error: ${error.message}`)
      setMsg(`⚠️ Insufficient inventory for "${check.product}": need ${check.need}, have ${check.have}. Order marked out_of_stock.`)
      fetchAll(); return
    }

    // Deduct inventory
    for (const item of order.order_items || []) {
      let remaining = item.quantity
      const batches = inventory
        .filter(i => i.product_id === item.product_id && i.quantity > 0)
        .sort((a, b) => a.id - b.id)
      for (const batch of batches) {
        if (remaining <= 0) break
        const deduct = Math.min(batch.quantity, remaining)
        await supabase.from('inventory').update({ quantity: batch.quantity - deduct }).eq('id', batch.id)
        remaining -= deduct
      }
    }

    // Create delivery record and update order status
    const { error: delError } = await supabase.from('deliveries').upsert({
      order_id: orderId, delivery_staff_id: staffId, status: 'picked_up'
    }, { onConflict: 'order_id' })
    if (delError) return setMsg('Delivery Error: ' + delError.message)
    
    const { error: ordError } = await supabase.from('orders').update({ status: 'out_for_delivery' }).eq('id', orderId)
    if (ordError) return setMsg('Order Error: ' + ordError.message)
    
    setMsg('✅ Order dispatched! Inventory updated and delivery staff assigned.')
    fetchAll()
  }

  async function restoreInventory(order) {
    if (!order.order_items) return;
    for (const item of order.order_items) {
      const { data } = await supabase.from('inventory').select('*').eq('product_id', item.product_id).limit(1);
      if (data && data.length > 0) {
        await supabase.from('inventory').update({ quantity: data[0].quantity + item.quantity }).eq('id', data[0].id);
      }
    }
  }

  async function changeOrderStatus(orderId, status) {
    const o = orders.find(x => x.id === orderId)
    let payload = { status }
    
    if (status === 'pending' && o?.assigned_to) {
      payload.assigned_to = null
      await restoreInventory(o)
    }
    
    await supabase.from('orders').update(payload).eq('id', orderId)
    fetchAll()
  }

  function getAvailableStatuses(order) {
    const current = order.status;
    const isAssigned = !!order.assigned_to;
    let options = [current];

    if (!isAssigned || current === 'pending') {
      options.push('out_of_stock', 'cancelled');
    } else {
      options.push('out_of_stock', 'cancelled', 'pending');
    }

    return Array.from(new Set(options));
  }

  // ── PROCUREMENT INTAKE ──
  async function handleDispatchOrder(dispatchOrder, status) {
    setMsg('')
    const { error } = await supabase.from('cooperative_dispatch_orders').update({ status }).eq('id', dispatchOrder.id)
    if (error) return setMsg('Error: ' + error.message)
    
    if (status === 'received') {
      for (const item of dispatchOrder.cooperative_dispatch_items) {
        const { data: existing } = await supabase.from('warehouse_inventory').select('*').eq('product_name', item.product_name).maybeSingle()
        if (existing) {
          await supabase.from('warehouse_inventory').update({ quantity: Number(existing.quantity) + Number(item.quantity) }).eq('id', existing.id)
        } else {
          await supabase.from('warehouse_inventory').insert({
            product_name: item.product_name,
            quantity: item.quantity,
            unit: item.unit
          })
        }
      }
    }
    setMsg(`✅ Dispatch order marked as ${status}!`)
    fetchAll()
  }

  // ── HELPERS ──
  const deliveryStaff = users.filter(u => u.role === 'delivery')
  const assignableUsers = users.filter(u => ['farmer', 'cooperative'].includes(u.role))
  const getUserName = (id) => users.find(u => u.id === id)?.name || '—'

  const stats = {
    total_users: users.length,
    total_orders: orders.length,
    active_products: products.filter(p => p.is_active).length,
    pending_orders: orders.filter(o => o.status === 'pending').length,
    revenue: orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.total_amount, 0),
  }

  const roleCounts = ALL_ROLES.reduce((acc, r) => { acc[r] = users.filter(u => u.role === r).length; return acc }, {})

  // Procurement Intelligence
  const demandStats = orders.flatMap(o => o.order_items || []).reduce((acc, item) => {
    const name = item.products?.name
    if (!name) return acc
    acc[name] = (acc[name] || 0) + Number(item.quantity)
    return acc
  }, {})
  const topDemand = Object.entries(demandStats).sort((a,b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>⚙️ Admin Panel</h1>
          <p className="dash-sub">Platform management &amp; analytics</p>
        </div>
        <div className="tab-group">
          {['overview', 'procurement', 'orders', 'users', 'warehouse_products', 'deliveries', 'cooperatives'].map(t => (
            <button key={t} className={view === t ? 'tab active' : 'tab'} onClick={() => setView(t)}>
              {t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {msg && <div className="dash-msg" style={{ color: msg.includes('⚠️') ? '#f59e0b' : undefined }}>{msg}</div>}

      {/* ── OVERVIEW ── */}
      {view === 'overview' && (
        <>
          <div className="stats-overview">
            {[
              { label: 'Total Users',         value: stats.total_users,                            icon: '👥' },
              { label: 'Total Orders',         value: stats.total_orders,                           icon: '📦' },
              { label: 'Active Products',      value: stats.active_products,                        icon: '🥬' },
              { label: 'Pending Orders',       value: stats.pending_orders,                         icon: '⏳' },
              { label: 'Revenue (completed)',  value: `Rs ${stats.revenue.toLocaleString()}`,       icon: '💰', wide: true },
            ].map((s, i) => (
              <div key={i} className={`stat-card ${s.wide ? 'wide' : ''}`}>
                <span className="sc-icon">{s.icon}</span>
                <div className="sc-value">{s.value}</div>
                <div className="sc-label">{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <h2 style={{ color: 'var(--text)', marginBottom: '1rem', fontSize: '1.1rem' }}>👥 Users by Role</h2>
              <div className="stats-overview" style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
                {ALL_ROLES.map(role => (
                  <div key={role} className="stat-card">
                    <div className="sc-value">{roleCounts[role]}</div>
                    <div className="sc-label"><span className={`role-tag role-${role}`}>{role}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 style={{ color: 'var(--text)', marginBottom: '1rem', fontSize: '1.1rem' }}>📈 Procurement Intelligence Demand</h2>
              <div className="dash-card">
                <p style={{fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'1rem'}}>Top historic demands informing what to procure next from cooperatives:</p>
                {topDemand.map(([name, qty]) => {
                  const currStock = warehouseInventory.find(w => w.product_name === name)?.quantity || 0
                  const isLow = currStock < (qty * 0.5) // Suggest logic: Need at least 50% of total historic demand
                  return (
                    <div key={name} style={{display:'flex', justifyContent:'space-between', padding:'0.5rem 0', borderBottom:'1px solid var(--border)'}}>
                      <strong>{name}</strong>
                      <span style={{fontSize:'0.9rem'}}>Demand: {qty} <span style={{margin:'0 0.5rem'}}>|</span> Stock: <span style={{color: isLow ? '#ef4444' : '#4ade80'}}>{currStock}</span></span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PROCUREMENT INTAKE ── */}
      {view === 'procurement' && (
        <div className="orders-view">
          {dispatchOrders.length === 0 && <div className="empty-state">No dispatch requests from Cooperatives.</div>}
          {dispatchOrders.map(d => (
            <div key={d.id} className="dash-card" style={{borderLeft: d.status === 'received' ? '4px solid #4ade80' : d.status === 'approved' ? '4px solid #3b82f6' : '4px solid #f59e0b', marginBottom: '1rem'}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'1rem'}}>
                <h3 style={{margin:0}}>Dispatch #{d.id} <span style={{fontSize:'0.85rem', fontWeight:'normal', color:'var(--text-muted)'}}>• {d.cooperatives?.name} ({d.cooperatives?.location})</span></h3>
                <span className="badge" style={{background:'var(--bg)', color:'var(--text)'}}>{d.status.toUpperCase()}</span>
              </div>
              <table className="dash-table" style={{marginBottom:'1rem'}}>
                <thead><tr><th>Product</th><th>Qty</th><th>Expected Base Price</th></tr></thead>
                <tbody>
                  {d.cooperative_dispatch_items.map(i => (
                    <tr key={i.id}>
                      <td>{i.product_name}</td>
                      <td>{i.quantity} {i.unit}</td>
                      <td>{i.expected_price ? `Rs ${i.expected_price}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{display:'flex', gap:'0.5rem'}}>
                {d.status === 'pending' && (
                  <>
                    <button className="btn-sm" style={{background:'#3b82f6', color:'#fff', padding:'0.4rem 1rem'}} onClick={() => handleDispatchOrder(d, 'approved')}>✔️ Approve & Trigger Upstream Delivery</button>
                    <button className="btn-sm" style={{background:'#fee2e2', color:'#ef4444', border:'1px solid #fca5a5'}} onClick={() => handleDispatchOrder(d, 'rejected')}>Reject</button>
                  </>
                )}
                {d.status === 'approved' && (
                  <button className="btn-sm" style={{background:'#4ade80', color:'#0f172a', padding:'0.4rem 1rem'}} onClick={() => handleDispatchOrder(d, 'received')}>📦 Mark as Received in Warehouse</button>
                )}
                {d.status === 'received' && (
                  <span style={{fontSize:'0.85rem', color:'#4ade80'}}>✔ Items successfully added to Warehouse Inventory.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ORDERS ── */}
      {view === 'orders' && (
        <div className="orders-view">
          {orders.length === 0 && <div className="empty-state">📦<br />No consumer orders yet</div>}
          {orders.map(o => {
            const invCheck = checkInventory(o)
            return (
              <div key={o.id} className="order-card">
                <div className="order-top">
                  <span className="order-id">Order #{o.id}</span>
                  <span className="order-status" style={{ color: statusColor[o.status] }}>● {o.status.replace(/_/g, ' ')}</span>
                  <span className="order-date">{new Date(o.created_at).toLocaleDateString()}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#4ade80' }}>Rs {o.total_amount}</span>
                </div>
                <div className="order-bottom" style={{ marginBottom: '0.5rem' }}>
                  <span>Customer: <strong>{getUserName(o.consumer_id) || 'Guest'}</strong></span>
                  <span>📍 {o.delivery_address}</span>
                </div>
                <div className="order-items-list">
                  {o.order_items?.map(i => <span key={i.id}>{i.products?.name} × {i.quantity}</span>)}
                </div>

                {/* Inventory warning */}
                {!invCheck.ok && o.status === 'pending' && (
                  <div style={{ color: '#f59e0b', fontSize: '0.82rem', marginTop: '0.5rem' }}>
                    ⚠️ Low stock: "{invCheck.product}" needs {invCheck.need}, only {invCheck.have} available.
                  </div>
                )}

                {/* Assign Delivery Staff (from pending to dispatch) */}
                {o.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select id={`del-${o.id}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.82rem' }}>
                      <option value="">— Assign Delivery Staff —</option>
                      {deliveryStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button className="btn-status green" onClick={() => {
                      const sel = document.getElementById(`del-${o.id}`)
                      if (!sel.value) return setMsg('Please select a delivery staff member.')
                      dispatchToDelivery(o.id, sel.value, o)
                    }}>
                      🚚 Dispatch from Warehouse
                    </button>
                  </div>
                )}

                {/* Admin override */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>Admin Override Status:</span>
                  <select
                    value={o.status}
                    onChange={e => {
                      if (window.confirm(`Are you sure you want to change status to ${e.target.value.replace(/_/g, ' ')}?`)) {
                        changeOrderStatus(o.id, e.target.value)
                      }
                    }}
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                  >
                    {[o.status, 'pending', 'out_of_stock', 'cancelled', 'completed'].filter((v, i, a) => a.indexOf(v) === i).map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── USERS ── */}
      {view === 'users' && (
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th><th>Phone</th><th>Joined</th><th>Change Role</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td style={{ fontSize: '0.82rem' }}>{u.email}</td>
                  <td><span className={`role-tag role-${u.role}`}>{u.role}</span></td>
                  <td>{u.phone || '—'}</td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.82rem' }}>
                      {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <button className="btn-sm"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                      onClick={() => deleteUser(u.id, u.name)}>Delete</button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={7} className="empty-row">No users found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── WAREHOUSE & PRODUCTS ── */}
      {view === 'warehouse_products' && (
        <>
          <div className="dashboard-grid">
            <div className="dash-card">
              <h2>🏢 Warehouse Safe Inventory</h2>
              <p style={{fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'1rem'}}>Products safely arrived from cooperatives to the SajiloKhet warehouse.</p>
              {warehouseInventory.length === 0 ? <div className="empty-state-sm">Warehouse is empty. Receive dispatch orders first.</div> : (
                <div className="table-wrap">
                  <table className="dash-table">
                    <thead><tr><th>Product</th><th>Warehouse Qty</th><th>Added</th></tr></thead>
                    <tbody>
                      {warehouseInventory.map(w => (
                        <tr key={w.id}>
                          <td><strong>{w.product_name}</strong></td>
                          <td>{w.quantity} {w.unit}</td>
                          <td>{new Date(w.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="dash-card">
              <h2>🛒 List Product to Marketplace</h2>
              <p style={{fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'1rem'}}>Transfer items from the warehouse to active marketplace listings for consumers.</p>
              <form onSubmit={addProduct} className="auth-form">
                <div className="form-group">
                  <label>Select from Warehouse</label>
                  <select value={newProduct.warehouse_item_id} required onChange={e => setNewProduct(p => ({ ...p, warehouse_item_id: e.target.value }))}>
                    <option value="">— Select Origin Product —</option>
                    {warehouseInventory.map(w => <option key={w.id} value={w.id}>{w.product_name} (Avail: {w.quantity} {w.unit})</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Marketplace Description</label><input type="text" value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} placeholder="Selling description" /></div>
                <div className="form-group"><label>Selling Price (Rs)</label><input type="number" min="0" step="0.5" value={newProduct.price} required onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} placeholder="e.g. 70" /></div>
                <button type="submit" className="auth-submit" style={{background:'#8b5cf6'}}>Add to Marketplace</button>
              </form>
            </div>
          </div>

          <div style={{marginTop:'2rem'}}>
            <h2 style={{color:'var(--text)', marginBottom:'1rem'}}>🌐 Active Marketplace Listings</h2>
            <div className="table-wrap">
              <table className="dash-table">
                <thead><tr><th>Name</th><th>Unit</th><th>Price</th><th>Active</th><th>Toggle</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td><td>{p.unit}</td><td>Rs {p.price}</td>
                      <td><span className={p.is_active ? 'tag tag-green' : 'tag tag-gray'}>{p.is_active ? 'Active' : 'Hidden'}</span></td>
                      <td><button className="btn-sm" onClick={() => toggleProduct(p.id, p.is_active)}>{p.is_active ? 'Hide' : 'Show'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── DELIVERIES ── */}
      {view === 'deliveries' && (
        <div className="table-wrap">
          <table className="dash-table">
            <thead><tr><th>Del #</th><th>Order #</th><th>Address</th><th>Amount</th><th>Staff</th><th>Status</th></tr></thead>
            <tbody>
              {deliveries.map(d => (
                <tr key={d.id}>
                  <td>#{d.id}</td>
                  <td>#{d.order_id}</td>
                  <td>{d.orders?.delivery_address}</td>
                  <td>Rs {d.orders?.total_amount}</td>
                  <td>{getUserName(d.delivery_staff_id)}</td>
                  <td><span style={{ color: { assigned:'#f59e0b', picked_up:'#3b82f6', on_the_way:'#8b5cf6', delivered:'#4ade80' }[d.status] }}>● {d.status}</span></td>
                </tr>
              ))}
              {deliveries.length === 0 && <tr><td colSpan={6} className="empty-row">No deliveries yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── COOPERATIVES ── */}
      {view === 'cooperatives' && (
        <div className="table-wrap">
          <table className="dash-table">
            <thead><tr><th>ID</th><th>Name</th><th>Location</th><th>Manager</th><th>Created</th></tr></thead>
            <tbody>
              {cooperatives.map(c => (
                <tr key={c.id}>
                  <td>#{c.id}</td><td>{c.name}</td><td>{c.location}</td>
                  <td>{getUserName(c.manager_id) || <span style={{ color: '#6b7280' }}>No manager</span>}</td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {cooperatives.length === 0 && <tr><td colSpan={5} className="empty-row">No cooperatives yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
