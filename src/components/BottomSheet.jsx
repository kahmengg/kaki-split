import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function BottomSheet({ isOpen, onClose, children, title, confirmClose }) {
  const sheetRef = useRef(null)
  const closeRef = useRef(onClose)
  const confirmRef = useRef(confirmClose)
  const titleId = useId()
  const [viewportHeight, setViewportHeight] = useState(null)
  closeRef.current = onClose
  confirmRef.current = confirmClose

  const requestClose = () => {
    if (!confirmRef.current || confirmRef.current()) closeRef.current()
  }

  useEffect(() => {
    if (!isOpen) return
    const dialog = sheetRef.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Native modal dialogs contain focus and make the background inert.
    dialog.showModal()
    const updateViewport = () => setViewportHeight(window.visualViewport?.height || window.innerHeight)
    updateViewport()
    window.visualViewport?.addEventListener('resize', updateViewport)
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      window.visualViewport?.removeEventListener('resize', updateViewport)
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <dialog
      ref={sheetRef}
      aria-labelledby={titleId}
      className="app-bottom-sheet"
      style={{
        maxHeight: viewportHeight ? `${viewportHeight * 0.92}px` : '92dvh',
      }}
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClick={(event) => {
        // Only close clicks outside the bounds, not clicks in the content.
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          requestClose()
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
        <h2 id={titleId} className="text-lg font-bold text-gray-900">
          {title || 'Group actions'}
        </h2>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close dialog"
          className="min-h-11 min-w-11 rounded-full bg-gray-100 text-xl text-gray-700"
        >
          &times;
        </button>
      </header>
      <div className="sheet-content overflow-y-auto min-h-0">{children}</div>
    </dialog>,
    document.body,
  )
}
