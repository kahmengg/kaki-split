import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import AppLogo from '../components/AppLogo'
import { useToast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

const socialProof = [
  { label: 'Groups active', value: '2.4k+' },
  { label: 'Avg. settle time', value: '< 24h' },
  { label: 'Payment disputes', value: '-78%' },
]

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()
  const { signIn, signUp, signInWithGoogle, resendSignupConfirmation } = useAuth()
  const { isDark } = useTheme()

  const pendingInviteCode = useMemo(() => {
    const fromQuery = new URLSearchParams(location.search).get('invite')
    if (fromQuery) return String(fromQuery).trim().toUpperCase()

    const fromStorage = localStorage.getItem('kakisplit:pendingInviteCode')
    return fromStorage ? String(fromStorage).trim().toUpperCase() : ''
  }, [location.search])

  const oauthRedirectPath = useMemo(() => {
    if (pendingInviteCode) return `/join/${encodeURIComponent(pendingInviteCode)}`
    return '/dashboard'
  }, [pendingInviteCode])

  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSource, setLoadingSource] = useState('password')
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('')
  const [resendingVerification, setResendingVerification] = useState(false)

  const isEmailConfirmationRequiredError = (error) => {
    const message = String(error?.message || '').toLowerCase()
    return message.includes('email not confirmed') || message.includes('email not verified')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoadingSource('password')
    setLoading(true)

    try {
      if (mode === 'signup') {
        await signUp({ email, password, name })
        setPendingVerificationEmail(String(email || '').trim().toLowerCase())
        showToast('Account created! Check your email to confirm, then sign in.', 'success')
        setMode('login')
        setPassword('')
      } else {
        await signIn({ email, password })
        setPendingVerificationEmail('')
        showToast('Signed in successfully', 'success')
        if (pendingInviteCode) {
          navigate(`/join/${encodeURIComponent(pendingInviteCode)}`)
        } else {
          navigate('/dashboard')
        }
      }
    } catch (error) {
      if (mode === 'login' && isEmailConfirmationRequiredError(error)) {
        const normalizedEmail = String(email || '').trim().toLowerCase()
        if (normalizedEmail) setPendingVerificationEmail(normalizedEmail)
        showToast('Please verify your email before signing in. You can resend the verification email below.', 'error')
      } else {
        showToast(error.message || 'Unable to authenticate right now', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail || resendingVerification) return

    setResendingVerification(true)
    try {
      await resendSignupConfirmation({ email: pendingVerificationEmail, redirectPath: '/login' })
      showToast(`Verification email sent to ${pendingVerificationEmail}.`, 'success')
    } catch (error) {
      showToast(error.message || 'Unable to resend verification email right now.', 'error')
    } finally {
      setResendingVerification(false)
    }
  }

  const handleGoogle = async () => {
    setLoadingSource('google')
    setLoading(true)
    try {
      await signInWithGoogle({ redirectPath: oauthRedirectPath })
    } catch (error) {
      showToast(error.message || 'Google sign-in failed. Please use email & password.', 'error')
      setLoading(false)
      setLoadingSource('password')
    }
  }

  useEffect(() => {
    if (loadingSource !== 'google') return

    const timeoutId = window.setTimeout(() => {
      setLoading(false)
      setLoadingSource('password')
    }, 8000)

    const handleFocus = () => {
      setLoading(false)
      setLoadingSource('password')
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadingSource])

    return (
      <div className={`min-h-screen relative overflow-hidden transition-colors ${isDark ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100' : 'bg-gradient-to-b from-sky-50 via-white to-cyan-50 text-slate-900'}`}>
        {loading && loadingSource === 'google' && (
          <div className={`absolute inset-0 z-30 backdrop-blur-sm flex items-center justify-center px-6 ${isDark ? 'bg-slate-950/70' : 'bg-white/75'}`}>
            <div className={`rounded-3xl px-6 py-5 border text-center max-w-xs w-full ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-sky-100 shadow-xl'}`}>
              <div className="w-9 h-9 mx-auto border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
              <p className={`text-sm font-semibold mt-3 ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>Opening Google sign-in...</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>You'll be redirected in a moment.</p>
            </div>
          </div>
        )}

        <div className={`absolute -top-16 -right-12 h-56 w-56 rounded-full blur-2xl ${isDark ? 'bg-sky-900/20' : 'bg-sky-300/40'}`} />
        <div className={`absolute top-48 -left-20 h-64 w-64 rounded-full blur-2xl ${isDark ? 'bg-cyan-900/20' : 'bg-cyan-300/35'}`} />
        <div className={`absolute bottom-20 right-0 h-56 w-56 rounded-full blur-3xl ${isDark ? 'bg-sky-900/20' : 'bg-sky-300/35'}`} />


        <div className="relative z-10 px-5 pt-6 pb-6 space-y-4">
              <header className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <AppLogo size="md" showWordmark />
              </div>
                <div className="flex items-center gap-2">
                  <ThemeToggle className="px-2.5 py-1" />
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${isDark ? 'text-slate-300 bg-slate-800/80 border-slate-600' : 'text-sky-700 bg-white/90 border-sky-100'}`}>Trusted by friend groups</span>
                </div>
              </header>



            <section className="space-y-3">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${isDark ? 'border-sky-700/70 bg-sky-900/20' : 'border-sky-200 bg-white shadow-sm'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                <span className={`text-[11px] font-semibold tracking-wide ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>Split fast. Settle cleanly.</span>
              </div>

              <h1 className={`text-[1.8rem] font-black leading-tight tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Keep trips fun.
                <span className="block text-sky-500">No awkward money chasing.</span>
              </h1>

              <p className={`text-sm leading-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Built for roommates and travel squads. Add expenses in seconds, auto-calculate balances,
                and settle up with clarity.
              </p>

              {pendingInviteCode && (
                <div className={`rounded-2xl border px-3 py-2 ${isDark ? 'border-sky-700/70 bg-sky-900/25' : 'border-sky-200 bg-sky-50'}`}>
                  <p className={`text-xs font-semibold ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>You were invited to a group</p>
                  <p className={`text-[11px] mt-0.5 ${isDark ? 'text-sky-300/80' : 'text-sky-700/80'}`}>Sign in and we will join code <span className="font-mono font-bold">{pendingInviteCode}</span>.</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {socialProof.map((item) => (
                  <div key={item.label} className={`rounded-xl border px-2.5 py-2 text-center ${isDark ? 'border-slate-600 bg-slate-800' : 'border-sky-100 bg-white shadow-sm'}`}>
                    <p className={`text-sm font-black leading-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.value}</p>
                    <p className={`text-[10px] mt-1 leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.label}</p>
                  </div>
                ))}
              </div>
            </section>

          <section className={`rounded-[28px] text-gray-900 border p-5 backdrop-blur-sm ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white/95 border-sky-100 shadow-[0_18px_40px_rgba(14,165,233,0.12)]'}`}>

          <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              Create account
            </button>
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border-2 border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors font-semibold text-gray-700 text-sm disabled:opacity-60"
          >
            {loading && loadingSource === 'google' ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
                </svg>
                Redirecting to Google...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or continue with email</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
                  required={mode === 'signup'}
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-sky-500 text-white rounded-2xl font-bold text-base hover:bg-sky-600 active:bg-sky-700 transition-colors disabled:opacity-60 mt-1"
              style={{ boxShadow: '0 8px 20px rgba(14, 165, 233, 0.3)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
                  </svg>
                  {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
                </span>
              ) : mode === 'signup' ? (
                'Create account'
              ) : (
                'Sign in'
              )}
            </button>
            </form>

            {pendingVerificationEmail && mode === 'login' && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-[11px] text-amber-800">
                  Not verified yet? We can resend the confirmation link to <span className="font-semibold">{pendingVerificationEmail}</span>.
                </p>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendingVerification}
                  className="mt-2 inline-flex items-center justify-center rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {resendingVerification ? 'Sending...' : 'Resend verification email'}
                </button>
              </div>
            )}
  
              <p className="text-center text-xs text-gray-400 mt-4">
                By continuing, you agree to our{' '}
                <Link to="/terms" className="font-semibold text-sky-600 hover:text-sky-700">
                  Terms
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="font-semibold text-sky-600 hover:text-sky-700">
                  Privacy Policy
                </Link>
                .
              </p>

        </section>
      </div>
    </div>
  )
}
