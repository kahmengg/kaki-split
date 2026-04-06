import React from 'react'
import { useTheme } from '../hooks/useTheme'

export default function AppLogo({ size = 'md', showWordmark = true, className = '' }) {
  const { isDark } = useTheme()
  const sizeClass = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10'

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`.trim()}>
      <div className={`${sizeClass} relative rounded-2xl shadow-sm flex items-center justify-center overflow-hidden bg-gradient-to-br from-sky-300 via-sky-500 to-blue-700`}>
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_25%_20%,white_0%,transparent_55%)]" />
        <svg viewBox="0 0 24 24" className="relative w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="7" cy="9" r="2" fill="currentColor" stroke="none" />
          <circle cx="17" cy="9" r="2" fill="currentColor" stroke="none" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.8 17c.8-2.2 2.4-3.3 4.7-3.3s3.9 1.1 4.7 3.3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.2 17c.8-2.2 2.4-3.3 4.7-3.3s3.9 1.1 4.7 3.3" opacity="0.92" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5.5v8" />
        </svg>
      </div>
      {showWordmark && (
        <div>
          <p className={`text-[11px] uppercase tracking-[0.18em] font-semibold ${isDark ? 'text-sky-300/80' : 'text-sky-700/80'}`}>Settle up with your kaki</p>
          <p className={`text-lg font-bold leading-tight ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>Kaki Split</p>
        </div>
      )}
    </div>
  )
}
