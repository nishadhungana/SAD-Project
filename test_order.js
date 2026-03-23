import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ovxydmzxdbvnsaovkwdn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92eHlkbXp4ZGJ2bnNhb3Zrd2RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjQwMDEsImV4cCI6MjA4OTE0MDAwMX0.KXS0XhYDeLwy3erEr33slNsFqEtWd7257rj3Y5WunkQ'

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const email = 'testconsumer' + Date.now() + '@example.com'
  const password = 'password123'

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email, password, options: { data: { name: 'Test Consumer', role: 'consumer' } }
  })

  if (authError) {
    console.error('Auth Error:', authError.message)
    return
  }

  console.log('User signed up:', authData.user.id)

  await new Promise(r => setTimeout(r, 1000))

  const { data: products, error: productError } = await supabase.from('products').select('*').limit(1)
  if (productError) { console.error('Product fetch error:', productError); return }
  if (!products || products.length === 0) { console.log('No products found'); return }

  const product = products[0]
  console.log('Product to buy:', product.id)

  const { data: order, error: orderError } = await supabase.from('orders').insert({
    consumer_id: authData.user.id,
    total_amount: product.price,
    status: 'pending',
    delivery_address: 'Test Address'
  }).select().single()

  if (orderError) {
    console.error('Order Error:', orderError)
    return
  }
  console.log('Order created:', order.id)

  const { error: itemError } = await supabase.from('order_items').insert([{
    order_id: order.id,
    product_id: product.id,
    quantity: 1,
    price: product.price
  }])

  if (itemError) {
    console.error('Item Error:', itemError)
    return
  }
  console.log('Items inserted')

  const { error: paymentError } = await supabase.from('payments').insert({
    order_id: order.id,
    amount: product.price,
    method: 'Cash on Delivery',
    status: 'pending'
  })

  if (paymentError) {
    console.error('Payment Error:', paymentError)
    return
  }
  console.log('Payment inserted. Success!')
}

run()
