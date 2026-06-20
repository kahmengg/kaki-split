import React from 'react'
import logoImage from '../assets/kaki-icon-transparent.png'

export default function AppLogo({ size = 'md', className = '' }) {
  const sizeClass =
    size === 'sm'
      ? 'h-12 w-12'
      : size === 'lg'
        ? 'h-36 w-36'
        : 'h-16 w-16'

  return (
    <div className={`inline-flex items-center justify-center overflow-hidden ${sizeClass} ${className}`.trim()}>
      <img src={logoImage} alt="Kaki Split" className="h-full w-full object-contain" draggable="false" />
    </div>
  )
}
