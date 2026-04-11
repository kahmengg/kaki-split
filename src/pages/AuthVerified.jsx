import React, { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AppLogo from '../components/AppLogo'
import ThemeToggle from '../components/ThemeToggle'
import { useTheme } from '../hooks/useTheme'

function normalizeNextPath(rawNext) {
  if (!rawNext || typeof rawNext !== 'string') return '/dashboard'
  if (!rawNext.startsWith('/')) return '/dashboard'
  if (rawNext.startsWith('//')) return '/dashboard'
  return rawNext
}

export default function AuthVerified() {
  const location = useLocation()
  const { isDark } = useTheme()

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return normalizeNextPath(params.get('next'))
  }, [location.search])

  return (
    <div className={`min-h-screen transition-colors ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-sky-50 text-slate-900'}`}>
      <div className="mx-auto max-w-md px-5 pt-6 pb-8">
        <header className="flex items-center justify-between">
          <AppLogo size="md" showWordmark />
          <ThemeToggle className="px-2.5 py-1" />
        </header>

        <main className={`mt-8 rounded-3xl border px-6 py-7 text-center ${isDark ? 'border-slate-700 bg-slate-900' : 'border-sky-100 bg-white shadow-sm'}`}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>

          <h1 className="mt-4 text-xl font-bold">Email verified</h1>
          <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            You are all set. You can close this tab and continue in KakiSplit, or tap below to continue now.
          </p>

          <Link
            to={nextPath}
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-sky-500 px-4 py-3 text-sm font-bold text-white hover:bg-sky-600"
          >
            Continue to KakiSplit
          </Link>

          <p className={`mt-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            If this page opened in a separate browser tab, it is safe to close it.
          </p>
        </main>
      </div>
    </div>
  )
}
