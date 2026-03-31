import React, { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'

const socialProof = [
  { label: 'Groups active', value: '2.4k+' },
  { label: 'Avg. settle time', value: '< 24h' },
  { label: 'Payment disputes', value: '-78%' },
]

const productHighlights = [
  {
    title: 'Smart expense splits',
    description: 'Split equally, by shares, or exact amounts without doing manual math.',
  },
  {
    title: 'Auto reminders in Telegram',
    description: 'Nudges go to your group chat so everyone sees what is still unsettled.',
  },
  {
    title: 'Clear debt simplification',
    description: 'See the fewest transfers needed to settle up quickly.',
  },
]

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()
  const { signIn, signUp, signInWithGoogle } = useAuth()

  const pendingInviteCode = useMemo(() => {
    const fromQuery = new URLSearchParams(location.search).get('invite')
    if (fromQuery) return String(fromQuery).trim().toUpperCase()

    const fromStorage = localStorage.getItem('kakisplit:pendingInviteCode')
    return fromStorage ? String(fromStorage).trim().toUpperCase() : ''
  }, [location.search])

  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSource, setLoadingSource] = useState('password')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoadingSource('password')
    setLoading(true)

    try {
      if (mode === 'signup') {
        await signUp({ email, password, name })
        showToast('Account created! Check your email to confirm, then sign in.', 'success')
        setMode('login')
        setPassword('')
        } else {
          await signIn({ email, password })
          showToast('Signed in successfully', 'success')
          if (pendingInviteCode) {
            navigate(`/join/${encodeURIComponent(pendingInviteCode)}`)
          } else {
            navigate('/dashboard')
          }
        }

    } catch (error) {
      showToast(error.message || 'Unable to authenticate right now', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setLoadingSource('google')
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      showToast(error.message || 'Google sign-in failed. Please use email & password.', 'error')
      setLoading(false)
      setLoadingSource('password')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      {loading && loadingSource === 'google' && (
        <div className="absolute inset-0 z-30 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="bg-white rounded-3xl px-6 py-5 border border-gray-200 shadow-xl text-center max-w-xs w-full">
            <div className="w-9 h-9 mx-auto border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-900 mt-3">Opening Google sign-in...</p>
            <p className="text-xs text-gray-500 mt-1">You'll be redirected in a moment.</p>
          </div>
        </div>
      )}

      <div className="absolute -top-16 -right-12 h-56 w-56 rounded-full bg-emerald-400/20 blur-2xl" />
      <div className="absolute top-48 -left-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-2xl" />
      <div className="absolute bottom-20 right-0 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative z-10 px-5 pt-8 pb-8 space-y-5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white text-emerald-600 flex items-center justify-center font-black text-lg shadow-sm">KS</div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/80 font-semibold">Fair split made easy</p>
              <p className="text-lg font-bold leading-tight">KakiSplit</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-emerald-100 bg-white/10 border border-white/15 px-2.5 py-1 rounded-full">Trusted by friend groups</span>
        </header>

        <section className="space-y-4">
          <h1 className="text-3xl font-black leading-tight tracking-tight">
            Keep trips fun.
            <span className="block text-emerald-300">Track every dollar fairly.</span>
          </h1>
            <p className="text-sm text-slate-200 leading-6">
              Built for roommates, travel squads, and kakis. Add expenses in seconds, auto-calculate balances,
              and settle without awkward reminders.
            </p>
            {pendingInviteCode && (
              <div className="rounded-2xl border border-emerald-200/60 bg-emerald-300/10 px-3 py-2">
                <p className="text-xs text-emerald-100 font-semibold">You were invited to a group</p>
                <p className="text-[11px] text-emerald-200 mt-0.5">Sign in and we will join code <span className="font-mono font-bold">{pendingInviteCode}</span>.</p>
              </div>
            )}


          <div className="grid grid-cols-3 gap-2.5">
            {socialProof.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center backdrop-blur-sm">
                <p className="text-base font-black text-white">{item.value}</p>
                <p className="text-[11px] text-slate-200 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-md p-4 space-y-3">
          {productHighlights.map((item, index) => (
            <div key={item.title} className={`flex gap-3 ${index !== productHighlights.length - 1 ? 'pb-3 border-b border-white/10' : ''}`}>
              <div className="h-6 w-6 shrink-0 rounded-full bg-emerald-400/20 border border-emerald-300/50 mt-0.5 flex items-center justify-center text-emerald-200 text-xs font-bold">
                {index + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-xs text-slate-200 mt-0.5 leading-5">{item.description}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-[28px] bg-white text-gray-900 border border-white/70 shadow-[0_18px_40px_rgba(2,6,23,0.25)] p-5">
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
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
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
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
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
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-emerald-500 text-white rounded-2xl font-bold text-base hover:bg-emerald-600 active:bg-emerald-700 transition-colors disabled:opacity-60 mt-1"
              style={{ boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)' }}
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

          <p className="text-center text-xs text-gray-400 mt-4">By continuing, you agree to our Terms and Privacy Policy.</p>
        </section>
      </div>
    </div>
  )
}
