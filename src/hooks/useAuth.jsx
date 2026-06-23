import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const AUTH_INIT_TIMEOUT_MS = 15000
const PROFILE_LOAD_TIMEOUT_MS = 25000
const NATIVE_AUTH_CALLBACK_URL = 'com.kakisplit.app://auth/callback'
const POST_AUTH_REDIRECT_KEY = 'kakisplit:postAuthRedirectPath'

function isRecoverableAuthLockError(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('auth token was released because another request stole it') || message.includes('lockmanager')
}

export function getFriendlyAuthError(error) {
  if (isRecoverableAuthLockError(error)) {
    return 'Your sign-in session is still syncing. Please wait a moment, then try again.'
  }

  const message = String(typeof error === 'string' ? error : error?.message || '').trim()
  if (!message) return 'Unable to verify your session right now. Please sign in again.'

  if (message.toLowerCase().includes('session check timed out')) {
    return 'Session check took too long. Please close and reopen the app, or sign in again.'
  }

  return message
}

async function withAuthLockRetry(operation, { attempts = 8, baseDelayMs = 160 } = {}) {
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
              setAuthError(getFriendlyAuthError(profileError))
            })
          }
        })
      .catch((error) => {
        console.error('Failed to initialize auth session', error)
        if (!isMounted) return
        setAuthError(getFriendlyAuthError(error))
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
            setAuthError(getFriendlyAuthError(error))
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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined

    let listenerHandle = null
    let cancelled = false

    const attachListener = async () => {
      listenerHandle = await CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url?.startsWith(NATIVE_AUTH_CALLBACK_URL)) return

        try {
          await Browser.close()
        } catch {
          // Browser may already be closed on some Android versions.
        }

        const parsedUrl = new URL(url)
        const authCode = parsedUrl.searchParams.get('code')
        if (!authCode) return

        const { data, error } = await supabase.auth.exchangeCodeForSession(authCode)
        if (error) {
          setAuthError(getFriendlyAuthError(error))
          return
        }

        const nextUser = data.session?.user
        if (nextUser) {
          setSession(data.session)
          setUser(nextUser)
          await loadProfile(nextUser, { softTimeout: true })
        }

        const redirectPath = localStorage.getItem(POST_AUTH_REDIRECT_KEY) || '/dashboard'
        localStorage.removeItem(POST_AUTH_REDIRECT_KEY)
        window.history.replaceState({}, '', redirectPath)
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
    }

    attachListener().catch((error) => {
      if (!cancelled) setAuthError(getFriendlyAuthError(error))
    })

    return () => {
      cancelled = true
      listenerHandle?.remove()
    }
  }, [loadProfile])

  const signInWithProvider = useCallback(async (provider, { redirectPath = '/dashboard' } = {}) => {
    const normalizedPath = typeof redirectPath === 'string' && redirectPath.startsWith('/') ? redirectPath : '/dashboard'
    const isNative = Capacitor.isNativePlatform()
    const redirectTo = isNative ? NATIVE_AUTH_CALLBACK_URL : `${window.location.origin}${normalizedPath}`

    if (isNative) {
      localStorage.setItem(POST_AUTH_REDIRECT_KEY, normalizedPath)
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: isNative,
      },
    })

    if (error) throw error

    if (isNative && data?.url) {
      await Browser.open({ url: data.url, windowName: '_self' })
    }

    return data
  }, [])

  const signInWithGoogle = useCallback((options) => signInWithProvider('google', options), [signInWithProvider])

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
