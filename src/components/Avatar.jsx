import React from 'react'
import { getUserInitials } from '../lib/format'

export default function Avatar({ user, size = 'md', ring = false, className = '' }) {
  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  }

  if (!user) return null

  return (
    <div
      className={`
        ${sizes[size]}
        rounded-full flex items-center justify-center font-bold text-white flex-shrink-0
        ${ring ? 'avatar-ring' : ''}
        ${className}
      `}
      style={{ backgroundColor: user.avatar_color || '#10b981' }}
    >
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.name} className="w-full h-full rounded-full object-cover" />
      ) : (
        getUserInitials(user)
      )}
    </div>
  )
}
