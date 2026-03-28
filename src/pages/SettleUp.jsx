import React, { useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { USERS, CURRENT_USER, formatMoney, GROUPS } from '../data/mockData'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'

// ─── Inline toast ─────────────────────────────────────────────────────────────
function InlineToast({ message, visible }) {
  return (
    <div
      className={`
        fixed top-5 left-1/2 z-[60] flex items-center gap-2.5
        bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl
        transition-all duration-300 pointer-events-none
        -translate-x-1/2 max-w-[340px] w-max
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}
      `}
    >
      <span className="text-emerald-400 text-base">✓</span>
      <span className="text-sm font-semibold">{message}</span>
    </div>
  )
}

// ─── Fake-but-deterministic QR (no re-randomise on re-render) ─────────────────
function PayNowQR({ phone }) {
  const cells = useMemo(() => {
    // Deterministic grid seeded by phone string
    const seed = phone.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return Array.from({ length: 15 * 15 }, (_, i) => {
      const row = Math.floor(i / 15)
      const col = i % 15
      if (row < 3 && col < 3) return true                   // top-left corner
      if (row < 3 && col > 11) return true                  // top-right corner
      if (row > 11 && col < 3) return true                  // bottom-left corner
      return ((seed * (i + 1) * 2654435761) >>> 0) % 3 !== 0
    })
  }, [phone])

  const size = 130
  const cellSize = size / 15

  return (
    <div className="flex flex-col items-center">
      <div className="bg-white p-4 rounded-2xl border-2 border-gray-200 shadow-sm">
        <svg width={size} height={size} className="block">
          {cells.map((filled, i) => {
            if (!filled) return null
            const row = Math.floor(i / 15)
            const col = i % 15
            return (
              <rect
                key={i}
                x={col * cellSize}
                y={row * cellSize}
                width={cellSize - 0.6}
                height={cellSize - 0.6}
                fill="#111827"
                rx={0.8}
              />
            )
          })}
        </svg>
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center">Scan with any Singapore banking app</p>
      <p className="text-xs text-gray-400 mt-0.5 font-medium">{phone}</p>
    </div>
  )
}

// ─── Main Pay screen ──────────────────────────────────────────────────────────
export default function PayScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromId = searchParams.get('from') || CURRENT_USER.id
  const toId = searchParams.get('to')
  const amount = parseFloat(searchParams.get('amount') || '0')

  const fromUser = USERS[fromId]
  const toUser = USERS[toId]
  const iOwe = fromId === CURRENT_USER.id

  const [partial, setPartial] = useState('')
  const [showPartial, setShowPartial] = useState(false)
  const [done, setDone] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)

  const payAmount = showPartial && partial ? parseFloat(partial) : amount
  const group = GROUPS.find(g => g.id === id)

  const showToast = (msg) => {
    setToastMsg(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 3200)
  }

  // Primary Pay CTA: copy PayNow + open PayLah
  const handlePayNowAndPayLah = () => {
    const payNowNumber = toUser?.paynow_number
    if (payNowNumber) {
      navigator.clipboard?.writeText(payNowNumber).catch(() => {})
    }
    showToast('PayNow number copied! Opening PayLah…')
    setTimeout(() => {
      window.location.href = 'dbspaylah://'
    }, 300)
  }

  const handleMarkPaid = () => {
    setDone(true)
    setShowConfirm(false)
    setTimeout(() => navigate(`/groups/${id}`), 1500)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Paid!</h2>
          <p className="text-gray-500">Redirecting back…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <InlineToast message={toastMsg} visible={toastVisible} />

      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/groups/${id}`)} className="text-gray-500 -ml-1">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-xl font-black text-gray-900">Pay</h1>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Transfer card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            {/* From */}
            <div className="flex flex-col items-center gap-1">
              <Avatar user={fromUser} size="lg" />
              <span className="text-xs font-semibold text-gray-600">
                {fromId === CURRENT_USER.id ? 'You' : fromUser?.display_name}
              </span>
            </div>

            {/* Amount */}
            <div className="flex flex-col items-center gap-1 flex-1 px-4">
              <div className={`font-black text-2xl ${iOwe ? 'text-red-500' : 'text-emerald-600'}`}>
                {formatMoney(amount)}
              </div>
              <div className="flex items-center gap-1 w-full">
                <div className="h-px flex-1 bg-gray-200" />
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <span className="text-xs text-gray-400">{group?.name}</span>
            </div>

            {/* To */}
            <div className="flex flex-col items-center gap-1">
              <Avatar user={toUser} size="lg" />
              <span className="text-xs font-semibold text-gray-600">
                {toId === CURRENT_USER.id ? 'You' : toUser?.display_name}
              </span>
            </div>
          </div>

          {/* Partial toggle */}
          <button
            onClick={() => setShowPartial(!showPartial)}
            className="w-full text-center text-sm text-emerald-600 font-medium"
          >
            {showPartial ? '← Pay full amount' : 'Pay partial amount'}
          </button>

          {showPartial && (
            <div className="mt-3">
              <input
                type="text"
                inputMode="decimal"
                value={partial}
                onChange={e => setPartial(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder={`0.00 (max ${amount.toFixed(2)})`}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-center font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          )}
        </div>

        {/* PayNow QR + PayLah CTA */}
        {iOwe && toUser?.paynow_number && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-gray-900">Pay {toUser.display_name}</p>
                <p className="text-gray-500 text-sm mt-0.5">{formatMoney(payAmount)} via PayNow</p>
              </div>
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-xl px-2.5 py-1">
                <span className="text-sm">📱</span>
                <span className="text-xs font-bold text-red-600">PayNow</span>
              </div>
            </div>

            <div className="flex justify-center mb-5">
              <PayNowQR phone={toUser.paynow_number} />
            </div>

            {/* One-tap Pay button */}
            <button
              onClick={handlePayNowAndPayLah}
              className="w-full py-4 bg-emerald-500 text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}
            >
              <span>📋</span>
              Copy PayNow &amp; Open PayLah
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">
              Copies {toUser.paynow_number} · opens PayLah app
            </p>
          </div>
        )}

        {/* Mark as paid manually */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-1">Already paid outside the app?</p>
          <p className="text-xs text-gray-400 mb-3">Mark as paid to update everyone's balance.</p>
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full py-3.5 bg-gray-900 text-white rounded-full font-bold text-sm active:bg-gray-700 transition-colors"
          >
            Mark {formatMoney(payAmount)} as paid ✓
          </button>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50 backdrop-blur-[2px]"
            style={{ maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            style={{ maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}
          >
            <div className="bg-white rounded-3xl p-6 w-full shadow-2xl">
              <h3 className="text-lg font-black text-gray-900 mb-2">Confirm payment</h3>
              <p className="text-gray-500 text-sm mb-5">
                Mark {formatMoney(payAmount)} as paid? This will update balances for everyone in the group.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-full font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkPaid}
                  className="flex-1 py-3 bg-emerald-500 text-white rounded-full font-bold text-sm"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <BottomNav groupId={id} onFABPress={() => navigate(`/groups/${id}`)} />
    </div>
  )
}
