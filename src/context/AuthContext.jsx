import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (data) {
      setProfile(data)
    } else {
      console.warn("Profile missing, rebuilding from session metadata...")
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const newProfile = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || 'User',
          role: session.user.user_metadata?.role || 'consumer'
        }
        const { data: createdObj } = await supabase.from('profiles').insert(newProfile).select().maybeSingle()
        setProfile(createdObj || null)
      } else {
        setProfile(null)
      }
    }
    setLoading(false)
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signUp(email, password, name, role) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, role } }
    })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
