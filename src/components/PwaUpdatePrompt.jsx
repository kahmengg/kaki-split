import React, { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function PwaUpdatePrompt() {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState(null)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  async function updateApp() {
    setUpdating(true)
    setError(null)
    try {
      // Reload only after the user has had a chance to finish their expense.
      await updateServiceWorker(true)
    } catch {
      setError('Unable to update right now. Please try again later.')
      setUpdating(false)
    }
  }

  return (
    <section
      role="status"
      aria-label="App update available"
      className="fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-sky-200 bg-white p-4 shadow-lg"
    >
      <p className="text-sm font-bold text-gray-900">A new version of Kaki Split is ready</p>
      <p className="mt-1 text-xs text-gray-600">Finish your expense before updating. Updating reloads the app.</p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={updateApp} disabled={updating} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {updating ? 'Updating...' : 'Update now'}
        </button>
        <button type="button" onClick={() => setNeedRefresh(false)} disabled={updating} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 disabled:opacity-60">
          Later
        </button>
      </div>
    </section>
  )
}
