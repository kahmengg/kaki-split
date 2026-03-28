import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    navigate('/dashboard')
  }

  const handleGoogle = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 pt-16 pb-20 px-6">
        {/* Background decoration */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full" />
        <div className="absolute -bottom-16 -left-8 w-64 h-64 bg-white/5 rounded-full" />
        <div className="absolute top-20 right-8 w-20 h-20 bg-teal-400/20 rounded-full" />

        <div className="relative">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center">
              <span className="text-emerald-600 font-black text-lg">FS</span>
            </div>
            <span className="text-white font-bold text-xl">FairSplit</span>
          </div>

          <h1 className="text-3xl font-black text-white leading-tight mb-2">
            Split expenses,<br />not friendships.
          </h1>
          <p className="text-emerald-100 text-base mt-2">
            The fastest way to split bills with zero confusion.
          </p>

          {/* Stats */}
          <div className="flex gap-6 mt-6">
            <div>
              <div className="text-white font-bold text-xl">10s</div>
              <div className="text-emerald-200 text-xs">to log an expense</div>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <div className="text-white font-bold text-xl">1 tap</div>
              <div className="text-emerald-200 text-xs">to settle up</div>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <div className="text-white font-bold text-xl">0</div>
              <div className="text-emerald-200 text-xs">spreadsheets</div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth card */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-6 relative z-10 px-6 pt-8 pb-8">
        {/* Tab toggle */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
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

        {/* Google OAuth */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border-2 border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors font-semibold text-gray-700 text-sm mb-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
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
              onChange={e => setEmail(e.target.value)}
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
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-base hover:bg-emerald-600 active:bg-emerald-700 transition-colors disabled:opacity-60 mt-2"
            style={{ boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
                </svg>
                {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
              </span>
            ) : (
              mode === 'signup' ? 'Create account' : 'Sign in'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          By continuing you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  )
}
