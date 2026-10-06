import React, { useEffect, useRef, useState } from 'react'

export default function SwipeDeleteRow({ children, canDelete, onDelete, label = 'expense', actionLabel = 'Delete' }) {
  const [offset, setOffset] = useState(0)
  const gesture = useRef(null)
  const rowRef = useRef(null)
  const actionRef = useRef(null)
  const focusAction = useRef(false)
  const suppressClick = useRef(false)
  const width = 88
  useEffect(() => {
    if (offset && focusAction.current) actionRef.current?.focus()
    focusAction.current = false
  }, [offset])
  if (!canDelete) return children
  const finish = event => {
    if (!gesture.current) return
    suppressClick.current = gesture.current.horizontal
    setOffset(value => value < -width / 2 ? -width : 0)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    gesture.current = null
  }
  return <div ref={rowRef} role="group" tabIndex={0} aria-label={`${label}. Swipe left to reveal ${actionLabel.toLowerCase()}, or press Left Arrow.`}
    className="relative overflow-hidden border-b border-gray-50 last:border-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
    onKeyDown={event => {
      if (event.key === 'Escape') { setOffset(0); rowRef.current?.focus() }
      if (event.target === event.currentTarget && ['ArrowRight', 'ArrowLeft'].includes(event.key)) {
        event.preventDefault(); focusAction.current = event.key === 'ArrowLeft'; setOffset(event.key === 'ArrowLeft' ? -width : 0)
      }
    }}>
    <button ref={actionRef} type="button" aria-label={`${actionLabel} ${label}`} tabIndex={offset ? 0 : -1} aria-hidden={!offset}
      onClick={() => { setOffset(0); onDelete() }}
      style={{ visibility: offset ? 'visible' : 'hidden' }}
      className="absolute inset-y-0 right-0 w-[88px] bg-red-600 text-white font-bold text-sm">{actionLabel}</button>
    <div className="relative swipe-row-surface touch-pan-y" style={{ transform: `translateX(${offset}px)` }}
      onClickCapture={event => {
        // A completed drag must not also activate the row's details link.
        if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false }
      }}
      onPointerDown={event => {
        if (event.button !== 0) return
        suppressClick.current = false
        gesture.current = { x: event.clientX, y: event.clientY, initial: offset, horizontal: false }
      }}
      onPointerMove={event => {
        const start = gesture.current
        if (!start) return
        const dx = event.clientX - start.x; const dy = event.clientY - start.y
        // Leave vertical scrolling native; capture only a deliberate horizontal swipe.
        if (!start.horizontal && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { gesture.current = null; return }
        if (!start.horizontal && Math.abs(dx) > 8) { start.horizontal = true; event.currentTarget.setPointerCapture?.(event.pointerId) }
        if (start.horizontal) setOffset(Math.max(-width, Math.min(0, start.initial + dx)))
      }} onPointerUp={finish} onPointerCancel={() => { gesture.current = null; setOffset(0) }}>
      {children}
    </div>
  </div>
}
