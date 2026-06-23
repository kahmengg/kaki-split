import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AppLogo from '../components/AppLogo'
import ThemeToggle from '../components/ThemeToggle'
import { useToast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

const valuePoints = [
  { text: 'Receipt scans for faster entry', color: 'bg-teal-500' },
  { text: 'Telegram reminders before it gets awkward', color: 'bg-blue-500' },
  { text: 'PayNow-ready settle ups', color: 'bg-amber-500' },
]

export default function Login() {
  const location = useLocation()
  const showToast = useToast()
  const { signInWithGoogle } = useAuth()
  const { isDark } = useTheme()
  const [loadingProvider, setLoadingProvider] = useState('')

  const pendingInviteCode = useMemo(() => {
    const fromQuery = new URLSearchParams(location.search).get('invite')
    if (fromQuery) return String(fromQuery).trim().toUpperCase()

    const fromStorage = localStorage.getItem('kakisplit:pendingInviteCode')
    return fromStorage ? String(fromStorage).trim().toUpperCase() : ''
  }, [location.search])

  const postAuthPath = useMemo(() => {
    if (pendingInviteCode) return `/join/${encodeURIComponent(pendingInviteCode)}`
    return '/dashboard'
  }, [pendingInviteCode])

  const handleGoogle = async () => {
    setLoadingProvider('google')
    try {
      // Preserve invite redirects no matter which OAuth provider the user picks.
      await signInWithGoogle({ redirectPath: postAuthPath })
    } catch (error) {
      showToast(error.message || 'Google sign-in failed. Please try again.', 'error')
      setLoadingProvider('')
    }
  }

  useEffect(() => {
    if (!loadingProvider) return

    const timeoutId = window.setTimeout(() => setLoadingProvider(''), 8000)
    const handleFocus = () => setLoadingProvider('')

    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadingProvider])

  const isLoading = Boolean(loadingProvider)

  return (
    <div className={`min-h-screen transition-colors ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-sky-50 text-slate-950'}`}>
      {isLoading && (
        <div className={`fixed inset-0 z-30 flex items-center justify-center px-6 backdrop-blur-sm ${isDark ? 'bg-slate-950/75' : 'bg-white/75'}`}>
          <div className={`w-full max-w-xs rounded-3xl px-6 py-5 text-center shadow-xl ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="mx-auto h-9 w-9 app-spinner rounded-full border-4 border-sky-200 border-t-sky-500" />
            <p className={`mt-3 text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
              Opening Google sign-in...
            </p>
            <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>You'll be redirected in a moment.</p>
          </div>
        </div>
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-6 pt-4" style={{ paddingBottom: 'max(22px, env(safe-area-inset-bottom))' }}>
        <header className="flex items-center justify-end">
          <ThemeToggle className="px-2.5 py-1" />
        </header>

        <main className="flex flex-1 flex-col justify-between">
          <section className="pt-3">
            <div className="flex flex-col items-center">
              <AppLogo size="lg" />
              <p
                className={`mt-3 text-center text-[2.7rem] font-extrabold leading-none tracking-[-0.025em] ${isDark ? 'text-white' : 'text-slate-950'}`}
                style={{ fontFamily: '"Poppins", "Avenir Next", "Montserrat", "Proxima Nova", "Inter", system-ui, sans-serif' }}
              >
                kaki<span className="text-blue-500">split</span>
              </p>
            </div>

            <div className="mt-7">
              <h1 className={`text-[2.55rem] font-black leading-[1.02] tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>
                Split fast.
                <span className="block text-amber-500">Stay friends.</span>
              </h1>
              <p className={`mt-5 max-w-[340px] text-[15px] leading-7 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                A cleaner way to manage shared meals, trips, and hangouts without awkward money chats.
              </p>
            </div>

            {pendingInviteCode && (
              <div className={`mt-7 rounded-3xl px-4 py-3 ${isDark ? 'bg-sky-950/60 text-sky-200' : 'bg-white/80 text-sky-800 shadow-sm'}`}>
                <p className="text-xs font-bold">Group invite ready</p>
                <p className="mt-1 text-xs">Sign in to join code <span className="font-mono font-bold">{pendingInviteCode}</span>.</p>
              </div>
            )}

            <div className="mt-10 grid gap-3">
              {valuePoints.map((point) => (
                <div key={point.text} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${isDark ? 'bg-white/[0.04]' : 'bg-white/70 shadow-sm'}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full ${point.color} text-[11px] font-black text-white`}>&#10003;</span>
                  <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{point.text}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-8">
            <button
              onClick={handleGoogle}
              disabled={isLoading}
              className={`flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-sm font-black shadow-[0_18px_36px_rgba(14,165,233,0.16)] transition-transform active:scale-[0.99] disabled:opacity-60 ${
                isDark
                  ? 'bg-white/10 text-white ring-1 ring-sky-400/30'
                  : 'bg-white/85 text-slate-900 ring-1 ring-sky-200'
              }`}
            >
              {loadingProvider === 'google' ? (
                <>
                  <svg className="h-4 w-4 app-spinner" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
                  </svg>
                  Redirecting to Google...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <p className={`mx-auto mt-4 max-w-xs text-center text-xs leading-5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              By continuing, you agree to our{' '}
              <Link to="/terms" className="font-semibold text-sky-600">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="font-semibold text-sky-600">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}
