import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

function fallbackName(user) {
  const fromMeta = user?.user_metadata?.display_name || user?.user_metadata?.full_name
  if (fromMeta && fromMeta.trim()) return fromMeta.trim()
  if (user?.email) return user.email.split('@')[0]
  return 'FairSplit User'
}

async function ensureProfileRow(user) {
  if (!user?.id) return null

  const payload = {
    id: user.id,
    display_name: fallbackName(user),
    email: user.email,
  }

  const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
  if (error) {
    throw error
  }

  const { data, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (fetchError) throw fetchError
  return data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (nextUser) => {
    if (!nextUser?.id) {
      setProfile(null)
      return null
    }

    const nextProfile = await ensureProfileRow(nextUser)
    setProfile(nextProfile)
    return nextProfile
  }, [])

  useEffect(() => {
    let isMounted = true

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) throw error

        if (!isMounted) return
        const currentSession = data.session
        setSession(currentSession)
        setUser(currentSession?.user ?? null)

        if (currentSession?.user) {
          await loadProfile(currentSession.user)
        }
      })
      .catch((error) => {
        console.error('Failed to initialize auth session', error)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (nextSession?.user) {
        try {
          await loadProfile(nextSession.user)
        } catch (error) {
          console.error('Failed to refresh profile after auth state change', error)
          setProfile(null)
        }
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }, [])

  const signUp = useCallback(async ({ email, password, name }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
        },
      },
    })

    if (error) throw error

    if (data.user) {
      await ensureProfileRow({
        ...data.user,
        user_metadata: {
          ...data.user.user_metadata,
          display_name: name || data.user.user_metadata?.display_name,
        },
      })
    }

    return data
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/#/dashboard`,
        },

    })

    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return null
    return loadProfile(user)
  }, [loadProfile, user])

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      refreshProfile,
    }),
    [loading, profile, refreshProfile, session, signIn, signInWithGoogle, signOut, signUp, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return value
}
