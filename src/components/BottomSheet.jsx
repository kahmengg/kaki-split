import React, { useEffect, useRef } from 'react'

export default function BottomSheet({ isOpen, onClose, children, title, height = 'auto' }) {
  const sheetRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
        onClick={onClose}
        style={{ maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white rounded-t-3xl z-50 shadow-2xl"
        style={{
          maxHeight: '92vh',
          animation: 'slideUp 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Title */}
        {title && (
          <div className="flex items-center justify-between px-5 pb-3 pt-1 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: title ? 'calc(92vh - 80px)' : 'calc(92vh - 40px)' }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(100%); }
          to { transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  )
}
