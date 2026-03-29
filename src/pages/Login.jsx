import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'

const heroClass = 'from-slate-950 via-slate-900 to-emerald-950'
const accentCardClass = 'bg-white/10 border-white/15 text-white'

export default function Login() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { signIn, signUp, signInWithGoogle } = useAuth()

  const [mode, setMode] = useState('login')
  const [authExpanded, setAuthExpanded] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
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
        navigate('/dashboard')
      }
    } catch (error) {
      showToast(error.message || 'Unable to authenticate right now', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      showToast(error.message || 'Google sign-in failed. Please use email & password.', 'error')
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen bg-gradient-to-b ${heroClass} flex flex-col relative overflow-hidden transition-colors duration-500`}>
      <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/10 blur-sm" />
      <div className="absolute top-40 -left-16 w-64 h-64 rounded-full bg-white/10" />
      <div className="absolute bottom-44 right-6 w-40 h-40 rounded-full bg-emerald-200/20" />

      <div className="relative z-10 px-6 pt-10 pb-6 text-white">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-white text-emerald-600 flex items-center justify-center font-black text-lg shadow-sm">FS</div>
          <span className="font-bold text-xl tracking-tight">FairSplit</span>
        </div>

        <h1 className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider bg-white/15 rounded-full px-3 py-1 border border-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-200" />
          Split expenses, not friendships
        </h1>

        <p className="text-emerald-50 mt-4 text-sm leading-6 max-w-[330px]">Track who paid, who owes, and settle quickly.</p>

        <div className="grid grid-cols-3 gap-2 mt-5 text-center">
          <div className={`rounded-2xl py-3 border ${accentCardClass}`}>
            <p className="text-xl font-black">10s</p>
            <p className="text-[11px] text-white/85">log expense</p>
          </div>
          <div className={`rounded-2xl py-3 border ${accentCardClass}`}>
            <p className="text-xl font-black">1 tap</p>
            <p className="text-[11px] text-white/85">send reminder</p>
          </div>
          <div className={`rounded-2xl py-3 border ${accentCardClass}`}>
            <p className="text-xl font-black">0 stress</p>
            <p className="text-[11px] text-white/85">with friends</p>
          </div>
        </div>

        {!authExpanded && (
          <button
            onClick={() => setAuthExpanded(true)}
            className="mt-6 w-full py-3.5 bg-emerald-500 text-white rounded-full font-bold text-base hover:bg-emerald-600 active:bg-emerald-700 transition-colors"
            style={{ boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)' }}
          >
            Log in
          </button>
        )}
      </div>

      <div className={`relative z-10 mt-auto bg-white rounded-t-[32px] border-t border-white/40 transition-all duration-300 ${authExpanded ? 'pb-8 pt-4' : 'pb-5 pt-3'}`}>
        <button
          onClick={() => setAuthExpanded((v) => !v)}
          className="w-full flex flex-col items-center"
          aria-expanded={authExpanded}
          aria-label={authExpanded ? 'Collapse login section' : 'Expand login section'}
        >
          <div className="w-12 h-1.5 rounded-full bg-gray-200 mb-3" />
        </button>

        {authExpanded ? (
          <div className="px-6 animate-[fadein_.25s_ease-out]">
            <div className="flex bg-gray-100 rounded-2xl p-1 mb-5">
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
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border-2 border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors font-semibold text-gray-700 text-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">or</span>
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
                className="w-full py-4 bg-emerald-500 text-white rounded-full font-bold text-base hover:bg-emerald-600 active:bg-emerald-700 transition-colors disabled:opacity-60 mt-1"
                style={{ boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)' }}
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

            <p className="text-center text-xs text-gray-400 mt-5">By continuing you agree to our Terms & Privacy Policy</p>
          </div>
        ) : (
          <div className="px-6 pb-1">
            <button
              onClick={() => setAuthExpanded(true)}
              className="w-full py-3 bg-emerald-500 text-white rounded-full font-semibold text-sm hover:bg-emerald-600 active:bg-emerald-700 transition-colors"
            >
              Open login form
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
