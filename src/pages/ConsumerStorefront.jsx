import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import './Dashboard.css'

export default function ConsumerStorefront() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  // Restore cart and address from localStorage so they survive page navigation
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sk_cart') || '{}') } catch { return {} }
  })
  const [orders, setOrders] = useState([])
  const [view, setView] = useState(() =>
    Object.keys(JSON.parse(localStorage.getItem('sk_cart') || '{}')).length > 0 ? 'cart' : 'shop'
  )
  const [deliveryAddress, setDeliveryAddress] = useState(
    () => localStorage.getItem('sk_delivery_address') || ''
  )
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Persist cart to localStorage whenever it changes
  useEffect(() => { localStorage.setItem('sk_cart', JSON.stringify(cart)) }, [cart])
  // Persist delivery address
  useEffect(() => { localStorage.setItem('sk_delivery_address', deliveryAddress) }, [deliveryAddress])

  useEffect(() => { fetchProducts(); if (profile) fetchOrders() }, [profile])

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*, inventory(quantity)').eq('is_active', true)
    setProducts(data || [])
  }

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('orders').select('*, order_items(*, products(name)), deliveries(status)')
      .eq('consumer_id', profile.id).order('created_at', { ascending: false })
    if (error) console.error("Error fetching consumer orders:", error)
    setOrders(data || [])
  }

  function getTotalStock(product) {
    return product.inventory?.reduce((s, i) => s + Number(i.quantity), 0) || 0
  }

  function addToCart(id) {
    if (!profile) {
      alert("Please log in to add items to your cart.")
      navigate("/login?redirect=/consumer")
      return
    }
    setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }))
  }
  function removeFromCart(id) {
    setCart(c => { const n = { ...c }; if (n[id] > 1) n[id]--; else delete n[id]; return n })
  }

  const cartItems = products.filter(p => cart[p.id])
  const cartTotal = cartItems.reduce((s, p) => s + p.price * cart[p.id], 0)

  async function placeOrder() {
    if (!deliveryAddress.trim()) { setMsg('Please enter a delivery address.'); return }
    if (cartItems.length === 0) return
    
    setLoading(true); setMsg('')
    
    // 1. Create order
    const { data: order, error: orderError } = await supabase.from('orders').insert({
      consumer_id: profile?.id || null, total_amount: cartTotal,
      status: 'pending', delivery_address: deliveryAddress
    }).select().single()
    
    if (orderError) { setMsg('Order creation failed: ' + orderError.message); setLoading(false); return }
    
    // 2. Insert items
    const items = cartItems.map(p => ({ order_id: order.id, product_id: p.id, quantity: cart[p.id], price: p.price }))
    const { error: itemsError } = await supabase.from('order_items').insert(items)
    
    if (itemsError) { setMsg('Item insertion failed: ' + itemsError.message); setLoading(false); return }
    
    // 3. Insert payment
    const { error: paymentsError } = await supabase.from('payments').insert({ 
      order_id: order.id, amount: cartTotal, method: 'Cash on Delivery', status: 'pending' 
    })
    
    if (paymentsError) { setMsg('Payment creation failed: ' + paymentsError.message); setLoading(false); return }
    
    // Success
    setCart({}); setDeliveryAddress('')
    localStorage.removeItem('sk_cart'); localStorage.removeItem('sk_delivery_address')
    setMsg('✅ Order placed successfully!')
    fetchOrders(); setView('orders'); setLoading(false)
  }

  async function cancelOrder(orderId) {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    setMsg('')
    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    if (error) { setMsg('Failed to cancel order: ' + error.message); return }
    setMsg('✅ Order cancelled successfully.')
    fetchOrders()
  }

  const statusColor = {
    pending: '#f59e0b', assigned: '#3b82f6', out_of_stock: '#ef4444',
    confirmed: '#8b5cf6', out_for_delivery: '#06b6d4', completed: '#4ade80',
    cancelled: '#ef4444', payment_failed: '#ef4444'
  }
  const orderSteps = ['pending', 'assigned', 'confirmed', 'out_for_delivery', 'completed']

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>🛒 Fresh From the Farm</h1>
          <p className="dash-sub">Direct from cooperative warehouses to your door</p>
        </div>
        <div className="tab-group">
          <button className={view==='shop'?'tab active':'tab'} onClick={()=>setView('shop')}>Shop</button>
          <button className={view==='cart'?'tab active':'tab'} onClick={()=>setView('cart')}>
            Cart {Object.keys(cart).length > 0 && <span className="badge">{Object.values(cart).reduce((a,b)=>a+b,0)}</span>}
          </button>
          <button className={view==='orders'?'tab active':'tab'} onClick={()=>setView('orders')}>My Orders</button>
        </div>
      </div>

      {msg && <div className="dash-msg">{msg}</div>}

      {view === 'shop' && (
        <div className="products-grid">
          {products.map(p => {
            const stock = getTotalStock(p)
            
            const getProductImage = (name) => {
              const n = name.toLowerCase()
              if (n.includes('tomato')) return 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=400&q=80'
              if (n.includes('cabbage')) return 'https://images.unsplash.com/photo-1518977822534-7041e6be7bff?auto=format&fit=crop&w=400&q=80'
              if (n.includes('carrot')) return 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=400&q=80'
              if (n.includes('potato')) return 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=400&q=80'
              if (n.includes('cauliflower') || n.includes('cauli')) return 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?auto=format&fit=crop&w=400&q=80'
              if (n.includes('spinach') || n.includes('lettuce')) return 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=400&q=80'
              if (n.includes('corn') || n.includes('maize')) return 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=400&q=80'
              if (n.includes('onion')) return 'https://images.unsplash.com/photo-1618512496248-a07ce83aa8cb?auto=format&fit=crop&w=400&q=80'
              if (n.includes('broccoli')) return 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=400&q=80'
              if (n.includes('pepper') || n.includes('chili')) return 'https://images.unsplash.com/photo-1588013273468-315fd88ea34c?auto=format&fit=crop&w=400&q=80'
              if (n.includes('garlic')) return 'https://images.unsplash.com/photo-1548057288-51846b0af404?auto=format&fit=crop&w=400&q=80'
              if (n.includes('mushroom')) return 'https://images.unsplash.com/photo-1511688878353-3a2f5be94cd7?auto=format&fit=crop&w=400&q=80'
              if (n.includes('eggplant') || n.includes('brinjal') || n.includes('gourd')) return 'https://images.unsplash.com/photo-1601648764658-cf37e8c89b70?auto=format&fit=crop&w=400&q=80'
              if (n.includes('pea') || n.includes('bean')) return 'https://images.unsplash.com/photo-1533100652671-87693eb129da?auto=format&fit=crop&w=400&q=80'
              if (n.includes('rice') || n.includes('grain')) return 'https://images.unsplash.com/photo-1586201375761-83865001e8ac?auto=format&fit=crop&w=400&q=80'
              if (n.includes('apple')) return 'https://images.unsplash.com/photo-1560806887-1e4cd0b6fac6?auto=format&fit=crop&w=400&q=80'
              if (n.includes('banana')) return 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&q=80'
              if (n.includes('orange')) return 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=400&q=80'
              if (n.includes('milk')) return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80'
              if (n.includes('cucumber')) return 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=400&q=80'
              
              // Fallback generic fresh produce
              return 'https://images.unsplash.com/photo-1595856728566-ce2dcb90fa96?auto=format&fit=crop&w=400&q=80'
            }

            return (
              <div key={p.id} className="product-card">
                <img 
                  src={getProductImage(p.name)} 
                  alt={p.name} 
                  className="product-image" 
                  onError={(e) => {
                    e.target.onerror = null; 
                    e.target.src = 'https://placehold.co/400x300/e2e8f0/4ade80?text=' + encodeURIComponent(p.name);
                  }} 
                />
                <div className="product-info">
                  <h3>{p.name}</h3>
                <p className="product-desc">{p.description}</p>
                <div className="product-meta">
                  <span className="product-price">Rs {p.price}/{p.unit}</span>
                  <span className={`product-stock ${stock < 10 ? 'low' : ''}`}>
                    {stock > 0 ? `${stock} ${p.unit} left` : 'Out of stock'}
                  </span>
                </div>
                {cart[p.id] ? (
                  <div className="qty-ctrl">
                    <button onClick={() => removeFromCart(p.id)}>−</button>
                    <span>{cart[p.id]}</span>
                    <button onClick={() => addToCart(p.id)} disabled={cart[p.id] >= stock}>+</button>
                  </div>
                ) : (
                  <button className="btn-add" onClick={() => addToCart(p.id)} disabled={stock === 0}>
                    {stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                  </button>
                )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === 'cart' && (
        <div className="cart-view">
          {cartItems.length === 0 ? (
            <div className="empty-state">🛒<br />Your cart is empty</div>
          ) : (
            <>
              <div className="cart-items">
                {cartItems.map(p => (
                  <div key={p.id} className="cart-item">
                    <span className="ci-name">{p.name}</span>
                    <div className="qty-ctrl small">
                      <button onClick={() => removeFromCart(p.id)}>−</button>
                      <span>{cart[p.id]}</span>
                      <button onClick={() => addToCart(p.id)}>+</button>
                    </div>
                    <span className="ci-price">Rs {p.price * cart[p.id]}</span>
                  </div>
                ))}
              </div>
              <div className="cart-summary">
                <div className="summary-total">Total: <strong>Rs {cartTotal.toFixed(2)}</strong></div>
                <div className="form-group">
                  <label>Delivery Address</label>
                  <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder="Your full delivery address in Kathmandu" />
                </div>
                {msg && <div style={{color: msg.includes('✅') ? 'green' : 'red', marginBottom:'10px', textAlign:'center', fontWeight:'bold'}}>{msg}</div>}
                <button className="btn-checkout" onClick={placeOrder} disabled={loading}>
                  {loading ? 'Placing order...' : 'Place Order'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {view === 'orders' && (
        <div className="orders-view">
          {orders.length === 0 ? (
            <div className="empty-state">📋<br />No orders yet. <button className="link-btn" onClick={() => setView('shop')}>Start shopping!</button></div>
          ) : orders.map(o => {
            const currentIdx = orderSteps.indexOf(o.status)
            const isFailed = ['out_of_stock', 'cancelled', 'payment_failed'].includes(o.status)
            return (
              <div key={o.id} className="order-card">
                <div className="order-top">
                  <span className="order-id">Order #{o.id}</span>
                  <span className="order-status" style={{color: statusColor[o.status]}}>● {o.status.replace(/_/g, ' ')}</span>
                  <span className="order-date">{new Date(o.created_at).toLocaleDateString()}</span>
                </div>

                {/* Visual timeline */}
                {!isFailed && (
                  <div style={{ display: 'flex', gap: '0.2rem', margin: '0.75rem 0', alignItems: 'center' }}>
                    {orderSteps.map((s, i) => {
                      const done = i <= currentIdx
                      return (
                        <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            background: done ? (statusColor[s] || '#4ade80') : 'var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.6rem', color: done ? '#fff' : 'var(--text-muted)',
                            fontWeight: 700
                          }}>
                            {done ? '✓' : i + 1}
                          </div>
                          <div style={{
                            width: '100%', height: 3, borderRadius: 2,
                            background: done ? (statusColor[s] || '#4ade80') : 'var(--border)'
                          }} />
                          <span style={{ fontSize: '0.6rem', color: done ? (statusColor[s] || '#4ade80') : 'var(--text-muted)', textAlign: 'center' }}>
                            {s.replace(/_/g, ' ')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {isFailed && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '0.5rem 0.75rem', marginTop: '0.5rem', color: '#ef4444', fontSize: '0.85rem' }}>
                    ⚠️ {o.status === 'out_of_stock' ? 'Some items are out of stock' : o.status === 'payment_failed' ? 'Payment failed' : 'Order was cancelled'}
                  </div>
                )}

                <div className="order-items-list">
                  {o.order_items?.map(i => <span key={i.id}>{i.products?.name} × {i.quantity}</span>)}
                </div>
                <div className="order-bottom">
                  <span>📍 {o.delivery_address}</span>
                  <span className="order-total">Rs {o.total_amount}</span>
                </div>
                {o.deliveries && <div className="order-delivery">🚚 Delivery: {(Array.isArray(o.deliveries) ? o.deliveries[0]?.status : o.deliveries.status)?.replace(/_/g, ' ')}</div>}
                
                {o.status === 'pending' && (
                  <button className="btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', marginTop: '0.75rem', width: '100%' }} onClick={() => cancelOrder(o.id)}>
                    ❌ Cancel Order
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
