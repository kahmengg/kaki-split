import React, { createContext, useContext, useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, type === 'error' ? 6000 : 4000)
    return () => window.clearTimeout(timer)
  }, [onClose, type])

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
      className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg ${type === 'error' ? 'bg-red-700 text-white' : 'bg-gray-900 text-white'}`}
    >
      <span className="flex-1 min-w-0 text-sm font-medium break-words">{message}</span>
      <button type="button" aria-label="Dismiss notification" onClick={onClose} className="min-h-11 min-w-11 text-xl">
        &times;
      </button>
    </div>
  )
}

const ToastContext = createContext(null)
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [notificationHost, setNotificationHost] = useState(document.body)
  useLayoutEffect(() => {
    // Keep announcements inside the active modal's accessible top layer.
    const updateHost = () => setNotificationHost(document.querySelector('dialog[open]') || document.body)
    updateHost()
    const observer = new MutationObserver(updateHost)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open'],
    })
    return () => observer.disconnect()
  }, [])
  const showToast = useCallback((message, type = 'success') => {
    // Unique IDs prevent simultaneous notifications from replacing one another.
    const id = crypto.randomUUID()
    setToasts((previous) => [...previous, { id, message, type }])
  }, [])
  const removeToast = useCallback((id) => setToasts((previous) => previous.filter((toast) => toast.id !== id)), [])
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {createPortal(
        <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 z-[100] pointer-events-none flex flex-col gap-2">
          {toasts.map((toast) => (
            <ToastEntry key={toast.id} toast={toast} removeToast={removeToast} />
          ))}
        </div>,
        notificationHost,
      )}
    </ToastContext.Provider>
  )
}
function ToastEntry({ toast, removeToast }) {
  const close = useCallback(() => removeToast(toast.id), [removeToast, toast.id])
  return <Toast message={toast.message} type={toast.type} onClose={close} />
}
export function useToast() {
  return useContext(ToastContext)
}
