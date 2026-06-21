import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const AUTH_INIT_TIMEOUT_MS = 15000
const PROFILE_LOAD_TIMEOUT_MS = 25000

function isRecoverableAuthLockError(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('auth token was released because another request stole it') || message.includes('lockmanager')
}

async function withAuthLockRetry(operation, { attempts = 6, baseDelayMs = 120 } = {}) {
  let lastError = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (!isRecoverableAuthLockError(error)) throw error
      lastError = error

      if (attempt === attempts - 1) break

      const backoff = baseDelayMs * (attempt + 1)
      const jitter = Math.floor(Math.random() * 100)
      await new Promise((resolve) => window.setTimeout(resolve, backoff + jitter))
    }
  }

  throw lastError
}

function withTimeout(promise, ms, errorMessage) {
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(errorMessage))
    }, ms)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId)
  })
}

function isProfileTimeoutError(error) {
  return String(error?.message || '').toLowerCase().includes('profile loading timed out')
}

function fallbackName(user) {
  const fromMeta = user?.user_metadata?.display_name || user?.user_metadata?.full_name
  if (fromMeta && fromMeta.trim()) return fromMeta.trim()
  if (user?.email) return user.email.split('@')[0]
  return 'Kaki Split User'
}

function shouldRestoreDeletedProfile(profile) {
  return profile?.display_name === 'Deleted user' && !profile?.email
}

async function ensureProfileRow(user) {
  if (!user?.id) return null

  const { data, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (fetchError) throw fetchError

  if (data) {
    if (!shouldRestoreDeletedProfile(data)) return data

    // If someone signs back in after deleting account data, rebuild the basic
    // profile from their current Google account instead of keeping "Deleted user".
    const restoredProfile = {
      display_name: fallbackName(user),
      email: user.email || null,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      updated_at: new Date().toISOString(),
    }

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(restoredProfile)
      .eq('id', user.id)
      .select('*')
      .maybeSingle()

    if (updateError) throw updateError
    return updated || { ...data, ...restoredProfile }
  }

  // Avoid client-side inserts here: profile creation should be handled by the
  // auth trigger (handle_new_auth_user). Returning a fallback object prevents
  // RLS failures from blocking the UI when the row has not replicated yet.
  return {
    id: user.id,
    display_name: fallbackName(user),
    email: user.email,
    avatar_url: null,
    avatar_color: null,
    paynow_number: null,
    paylah_handle: null,
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  const loadProfile = useCallback(async (nextUser, { softTimeout = false } = {}) => {
    if (!nextUser?.id) {
      setProfile(null)
      return null
    }

    try {
      const nextProfile = await withTimeout(
        ensureProfileRow(nextUser),
        PROFILE_LOAD_TIMEOUT_MS,
        'Profile loading timed out. Please refresh or sign in again.'
      )
      setProfile(nextProfile)
      return nextProfile
    } catch (error) {
      if (softTimeout && isProfileTimeoutError(error)) {
        const fallbackProfile = {
          id: nextUser.id,
          display_name: fallbackName(nextUser),
          email: nextUser.email,
          avatar_url: null,
          avatar_color: null,
          paynow_number: null,
          paylah_handle: null,
        }
        setProfile(fallbackProfile)
        return fallbackProfile
      }
      throw error
    }
  }, [])

  useEffect(() => {
    let isMounted = true

      withTimeout(
        withAuthLockRetry(() => supabase.auth.getSession()),
        AUTH_INIT_TIMEOUT_MS,
        'Session check timed out. Please refresh or sign in again.'
      )
        .then(({ data, error }) => {
          if (error) throw error

          if (!isMounted) return
          const currentSession = data.session
          setSession(currentSession)
          setUser(currentSession?.user ?? null)
          setAuthError(null)

          if (currentSession?.user) {
            loadProfile(currentSession.user, { softTimeout: true }).catch((profileError) => {
              if (!isMounted) return
              console.error('Failed to load profile during auth bootstrap', profileError)
              setAuthError(profileError.message || 'Unable to load your profile right now.')
            })
          }
        })
      .catch((error) => {
        console.error('Failed to initialize auth session', error)
        if (!isMounted) return
        setAuthError(error.message || 'Unable to verify your session right now.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

        if (nextSession?.user) {
          try {
            await loadProfile(nextSession.user, { softTimeout: true })
            setAuthError(null)
          } catch (error) {
            console.error('Failed to refresh profile after auth state change', error)
            setProfile(null)
            setAuthError(error.message || 'Unable to load your profile. Please sign in again.')
          }
        } else {

        setProfile(null)
        setAuthError(null)
      }

      setLoading(false)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signInWithGoogle = useCallback(async ({ redirectPath = '/dashboard' } = {}) => {
    const normalizedPath = typeof redirectPath === 'string' && redirectPath.startsWith('/') ? redirectPath : '/dashboard'

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${normalizedPath}`,
      },
    })

    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await withAuthLockRetry(() => supabase.auth.signOut())
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
      authError,
      signInWithGoogle,
      signOut,
      refreshProfile,
    }),
    [authError, loading, profile, refreshProfile, session, signInWithGoogle, signOut, user]
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
