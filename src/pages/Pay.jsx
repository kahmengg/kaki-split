import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import { useToast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { fetchGroupData, recordPayment } from '../lib/kakiSplitApi'
import { formatMoney } from '../lib/format'

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
      <span className="text-sky-400 text-base">✓</span>
      <span className="text-sm font-semibold">{message}</span>
    </div>
  )
}

function PayNowQR({ phone }) {
  const cells = useMemo(() => {
    const seed = String(phone || '')
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0)

    return Array.from({ length: 15 * 15 }, (_, i) => {
      const row = Math.floor(i / 15)
      const col = i % 15
      if (row < 3 && col < 3) return true
      if (row < 3 && col > 11) return true
      if (row > 11 && col < 3) return true
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

export default function PayScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const showToast = useToast()
  const { user } = useAuth()

  const fromId = searchParams.get('from') || user?.id
  const toId = searchParams.get('to')
  const amountFromQuery = Number.parseFloat(searchParams.get('amount') || '0')

  const [group, setGroup] = useState(null)
  const [usersById, setUsersById] = useState({})
  const [loading, setLoading] = useState(true)
  const [partial, setPartial] = useState('')
  const [showPartial, setShowPartial] = useState(false)
  const [done, setDone] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    if (!id || !user?.id) return

    async function loadData() {
      setLoading(true)
      try {
        const data = await fetchGroupData({ groupId: id, userId: user.id })
        setGroup(data?.group || null)
        setUsersById(data?.usersById || {})
      } catch (error) {
        showToast(error.message || 'Failed to load payment details', 'error')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id, showToast, user?.id])

  const fromUser = usersById[fromId]
  const toUser = usersById[toId]
  const iOwe = fromId === user?.id
  const payAmount = showPartial && partial ? Number.parseFloat(partial) : amountFromQuery

  const showInlineToast = (msg) => {
    setToastMsg(msg)
    setToastVisible(true)
    window.setTimeout(() => setToastVisible(false), 3200)
  }

  const handlePayNowAndPayLah = () => {
    const payNowNumber = toUser?.paynow_number
    if (payNowNumber) {
      navigator.clipboard?.writeText(payNowNumber).catch(() => {})
    }
    showInlineToast('PayNow number copied! Opening PayLah...')
    window.setTimeout(() => {
      window.location.href = 'dbspaylah://'
    }, 300)
  }

  const handleMarkPaid = async () => {
    if (!group || !fromId || !toId || !payAmount || !user?.id) return

    setRecording(true)
    try {
      await recordPayment({
        groupId: group.id,
        fromUserId: fromId,
        toUserId: toId,
        amount: payAmount,
        createdBy: user.id,
      })

      setDone(true)
      setShowConfirm(false)
      window.setTimeout(() => navigate(`/groups/${id}`), 1300)
    } catch (error) {
      showToast(error.message || 'Failed to record payment', 'error')
    } finally {
      setRecording(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!group || !fromUser || !toUser || !payAmount) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-gray-600 font-semibold">Payment details are incomplete.</p>
          <button onClick={() => navigate(`/groups/${id}`)} className="mt-4 px-4 py-2.5 rounded-full bg-sky-500 text-white text-sm font-bold">
            Back to group
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="w-20 h-20 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col items-center gap-1">
              <Avatar user={fromUser} size="lg" />
              <span className="text-xs font-semibold text-gray-600">{fromId === user.id ? 'You' : fromUser?.display_name}</span>
            </div>

            <div className="flex flex-col items-center gap-1 flex-1 px-4">
              <div className={`font-black text-2xl ${iOwe ? 'text-red-500' : 'text-sky-600'}`}>{formatMoney(amountFromQuery)}</div>
              <div className="flex items-center gap-1 w-full">
                <div className="h-px flex-1 bg-gray-200" />
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <span className="text-xs text-gray-400">{group.name}</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <Avatar user={toUser} size="lg" />
              <span className="text-xs font-semibold text-gray-600">{toId === user.id ? 'You' : toUser?.display_name}</span>
            </div>
          </div>

          <button onClick={() => setShowPartial((value) => !value)} className="w-full text-center text-sm text-sky-600 font-medium">
            {showPartial ? '← Pay full amount' : 'Pay partial amount'}
          </button>

          {showPartial && (
            <div className="mt-3">
              <input
                type="text"
                inputMode="decimal"
                value={partial}
                onChange={(event) => setPartial(event.target.value.replace(/[^0-9.]/g, ''))}
                placeholder={`0.00 (max ${amountFromQuery.toFixed(2)})`}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-center font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
          )}
        </div>

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

            <button
              onClick={handlePayNowAndPayLah}
              className="w-full py-4 bg-sky-500 text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ boxShadow: '0 4px 16px rgba(14,165,233,0.35)' }}
            >
              <span>📋</span>
              Copy PayNow &amp; Open PayLah!
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">Copies {toUser.paynow_number} · opens PayLah app</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-1">Already paid outside the app?</p>
          <p className="text-xs text-gray-400 mb-3">Mark as paid to update everyone's balance.</p>
          <button onClick={() => setShowConfirm(true)} className="w-full py-3.5 bg-gray-900 text-white rounded-full font-bold text-sm active:bg-gray-700 transition-colors">
            Mark {formatMoney(payAmount)} as paid ✓
          </button>
        </div>
      </div>

      {showConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50 backdrop-blur-[2px]" style={{ maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}>
            <div className="bg-white rounded-3xl p-6 w-full shadow-2xl">
              <h3 className="text-lg font-black text-gray-900 mb-2">Confirm payment</h3>
              <p className="text-gray-500 text-sm mb-5">Mark {formatMoney(payAmount)} as paid? This will update balances for everyone in the group.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-full font-bold text-sm">
                  Cancel
                </button>
                <button onClick={handleMarkPaid} disabled={recording} className="flex-1 py-3 bg-sky-500 text-white rounded-full font-bold text-sm disabled:opacity-60">
                  {recording ? 'Recording...' : 'Confirm'}
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
