import React, { useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import BottomSheet from '../components/BottomSheet'
import { useToast } from '../components/Toast'
import { useAppQueryInvalidation, useGroupData } from '../hooks/useAppQueries'
import { useAuth } from '../hooks/useAuth'
import { useGroupRealtime } from '../hooks/useRealtimeRefresh'
import { recordPayment } from '../lib/kakiSplitApi'
import { formatMoney } from '../lib/format'
import { buildPayNowPayload, normalizePayNowProxy } from '../lib/paynow'
import { forgetPaymentRequest, paymentRequestKey, readPaymentRequest, rememberPaymentRequest } from '../lib/paymentRequests'

function InlineToast({ message, visible }) {
  return (
    <div
      role="status"
      aria-atomic="true"
      className={`
        fixed top-5 left-1/2 z-[60] flex items-center gap-2.5
        bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl
        transition-all duration-300 pointer-events-none
        -translate-x-1/2 max-w-[340px] w-max
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}
      `}
    >
      <span className="text-sky-400 text-base">&#10003;</span>
      <span className="text-sm font-semibold">{message}</span>
    </div>
  )
}

function PayNowQR({ phone, amount, onActivate }) {
  const payload = useMemo(() => buildPayNowPayload({ proxy: phone, amount, editable: false }), [phone, amount])

  if (!payload) return null

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onActivate}
        className="bg-white p-4 rounded-2xl border-2 border-gray-200 shadow-sm active:scale-[0.98] transition-transform"
        aria-label="Copy PayNow number"
      >
        <QRCodeSVG value={payload} size={130} bgColor="#ffffff" fgColor="#111827" level="M" />
      </button>
      <p className="text-xs text-gray-500 mt-2 text-center">Scan with any Singapore banking app</p>
      <p className="text-xs text-gray-400 mt-0.5 text-center">Tap QR to copy PayNow details</p>
      <button
        type="button"
        onClick={onActivate}
        className="mt-1 text-xs font-bold text-sky-600 underline underline-offset-2"
      >
        {normalizePayNowProxy(phone)}
      </button>
    </div>
  )
}

export default function PayScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const showToast = useToast()
  const { user } = useAuth()
  const { invalidateGroup } = useAppQueryInvalidation()
  const groupQuery = useGroupData({ groupId: id, userId: user?.id })
  useGroupRealtime({ groupId: id, userId: user?.id })

  const fromId = searchParams.get('from') || user?.id
  const toId = searchParams.get('to')
  const amountFromQuery = Number.parseFloat(searchParams.get('amount') || '0')

  const [partial, setPartial] = useState('')
  const [showPartial, setShowPartial] = useState(false)
  const [done, setDone] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [recording, setRecording] = useState(false)
  const recordingRef = useRef(false)
  const redirectTimerRef = useRef(null)
  useEffect(() => () => window.clearTimeout(redirectTimerRef.current), [])
  const requestScope = { createdBy: user?.id, groupId: id, fromUserId: fromId, toUserId: toId }
  const requestKey = paymentRequestKey(requestScope)
  const [pending, setPending] = useState(() => readPaymentRequest(requestScope))
  const [confirmation, setConfirmation] = useState(null)
  useEffect(() => { setPending(readPaymentRequest(requestScope)); setConfirmation(null); setShowConfirm(false) }, [requestKey])

  useEffect(() => {
    if (groupQuery.error) {
      showToast(groupQuery.error.message || 'Failed to load payment details', 'error')
    }
  }, [groupQuery.error, showToast])

  const group = groupQuery.data?.group || null
  const usersById = groupQuery.data?.usersById || {}
  const loading = groupQuery.isLoading

  const fromUser = usersById[fromId]
  const toUser = usersById[toId]
  const iOwe = fromId === user?.id
  const currentBalance = groupQuery.data?.smartBalances?.find(balance => balance.from === fromId && balance.to === toId)?.amount || 0
  const canRecord = user?.id === fromId || user?.id === toId || user?.id === group?.created_by
  const pendingRequest = pending && paymentRequestKey(pending) === requestKey ? pending : null
  const payAmount = pendingRequest ? pendingRequest.amount : showPartial ? Number(partial) : currentBalance
  const amountError =
    !Number.isFinite(payAmount) || payAmount <= 0
      ? 'Enter an amount greater than zero.'
      : Math.round(payAmount * 100) / 100 !== payAmount
        ? 'Use at most two decimal places.'
      : !pendingRequest && payAmount > currentBalance
        ? 'The partial amount cannot exceed the outstanding balance.'
        : ''

  const showInlineToast = (msg) => {
    setToastMsg(msg)
    setToastVisible(true)
    window.setTimeout(() => setToastVisible(false), 3200)
  }

  const handleCopyPayNow = async () => {
    const payNowNumber = toUser?.paynow_number
    if (!payNowNumber) {
      showInlineToast('No PayNow number is saved for this person.')
      return
    }

    const normalized = normalizePayNowProxy(payNowNumber) || payNowNumber
    const details = `Pay ${toUser?.display_name || 'this person'} ${formatMoney(payAmount, group?.base_currency)} by PayNow: ${normalized}`

    // Mobile browsers cannot choose a user's default bank app directly, so use
    // the native share sheet when available and keep copy as the reliable fallback.
    let copied = false
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(details)
        copied = true
      }
    } catch {
      /* Sharing remains available when clipboard access is denied. */
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: 'PayNow details', text: details })
        showInlineToast('PayNow details shared.')
        return
      } catch {
        // User may cancel the share sheet; the details are still copied.
      }
    }

    showInlineToast(copied ? 'PayNow details copied.' : 'Unable to copy. Use the PayNow number shown above.')
  }

  const handleMarkPaid = async () => {
    if (recordingRef.current || !group || !fromId || !toId || amountError || !canRecord || !user?.id) return

    recordingRef.current = true
    setRecording(true)
    try {
      const request = pendingRequest || { ...requestScope, amount: confirmation?.amount ?? payAmount, expectedRevision: confirmation?.revision ?? group.ledger_revision, requestId: crypto.randomUUID() }
      rememberPaymentRequest(request)
      setPending(request)
      await recordPayment(request)
      forgetPaymentRequest(requestScope)
      setPending(null)

      setDone(true)
      setShowConfirm(false)
      invalidateGroup({ groupId: group.id, userId: user.id }).catch(() => showToast('Payment recorded. Refresh the group to see the latest balances.', 'error'))
      redirectTimerRef.current = window.setTimeout(() => navigate(`/groups/${id}`), 1300)
    } catch (error) {
      showToast(error.message || 'Failed to record payment', 'error')
      // A rejected transaction is safe to replace; an uncertain response keeps its ID.
      if (/^(The group balance changed|Payment exceeds|An expense is still|You cannot record|Enter a valid)/.test(error.message || '')) {
        forgetPaymentRequest(requestScope)
        setPending(null)
        setShowConfirm(false)
        invalidateGroup({ groupId: id, userId: user.id }).catch(() => showToast('Refresh the group before trying again.', 'error'))
      }
    } finally {
      recordingRef.current = false
      setRecording(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-500 rounded-full app-spinner" />
      </div>
    )
  }

  if (!group || !fromUser || !toUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-gray-600 font-semibold">Payment details are incomplete.</p>
          <button
            onClick={() => navigate(`/groups/${id}`)}
            className="mt-4 px-4 py-2.5 rounded-full bg-sky-500 text-white text-sm font-bold"
          >
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
            <span className="text-4xl">&#9989;</span>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2" role="status">Payment recorded</h2>
          <p className="text-gray-500">The group ledger is updated. Returning to the group…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <InlineToast message={toastMsg} visible={toastVisible} />

      <div className="bg-white px-5 pt-12 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button aria-label="Back to group" onClick={() => navigate(`/groups/${id}`)} className="text-gray-500 -ml-1">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-xl font-black text-gray-900">Pay</h1>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {groupQuery.error && <div role="alert" className="rounded-2xl bg-red-50 text-red-700 p-4 text-sm"><p>Unable to refresh the current balance. Check your connection before making a transfer.</p><button disabled={groupQuery.isFetching} onClick={() => groupQuery.refetch()} className="font-bold py-3">Refresh balance</button></div>}
        {pendingRequest ? <p role="status" className="rounded-2xl bg-amber-50 text-amber-800 p-4 text-sm">A previous attempt still needs confirmation. Retry its original record below; do not transfer money again. The same request cannot create a second entry.</p> : currentBalance !== amountFromQuery && <p role="status" className="rounded-2xl bg-sky-50 text-sky-700 p-4 text-sm">The balance has changed. Current outstanding amount: {formatMoney(currentBalance, group.base_currency)}.</p>}
        {!pendingRequest && !currentBalance && <p className="text-sm text-gray-700">No current payment is needed between these members. Return to the group for the latest balances.</p>}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col items-center gap-1">
              <Avatar user={fromUser} size="lg" />
              <span className="text-xs font-semibold text-gray-600">
                {fromId === user.id ? 'You' : fromUser?.display_name}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1 flex-1 px-4">
              <div className={`font-black text-2xl ${iOwe ? 'text-red-500' : 'text-sky-600'}`}>
                {formatMoney(currentBalance, group.base_currency)}
              </div>
              <div className="flex items-center gap-1 w-full">
                <div className="h-px flex-1 bg-gray-200" />
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-gray-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <span className="text-xs text-gray-400">{group.name}</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <Avatar user={toUser} size="lg" />
              <span className="text-xs font-semibold text-gray-600">
                {toId === user.id ? 'You' : toUser?.display_name}
              </span>
            </div>
          </div>

          <button
            disabled={Boolean(pendingRequest) || !currentBalance || groupQuery.isFetching || Boolean(groupQuery.error)}
            onClick={() => setShowPartial((value) => !value)}
            className="w-full text-center text-sm text-sky-600 font-medium"
          >
            {showPartial ? '\u2190 Pay full amount' : 'Pay partial amount'}
          </button>

          {showPartial && (
            <div className="mt-3">
              <label htmlFor="partial-payment" className="block text-sm font-semibold text-gray-700 mb-2">
                Partial payment ({group.base_currency})
              </label>
              <input
                id="partial-payment"
                aria-describedby="partial-feedback"
                aria-invalid={Boolean(amountError)}
                type="text"
                inputMode="decimal"
                value={partial}
                onChange={(event) => setPartial(event.target.value)}
                disabled={Boolean(pendingRequest) || recording}
                placeholder={`0.00 (max ${currentBalance.toFixed(2)})`}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-center font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <p id="partial-feedback" role="status" className="text-sm text-gray-600 mt-2">
                {amountError || `Recording ${formatMoney(payAmount, group.base_currency)}`}
              </p>
            </div>
          )}
        </div>

        {iOwe && toUser?.paynow_number && group.base_currency === 'SGD' && !amountError && !pendingRequest && !groupQuery.error && !groupQuery.isFetching && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-gray-900">Pay {toUser.display_name}</p>
                <p className="text-gray-500 text-sm mt-0.5">
                  {formatMoney(payAmount, group?.base_currency)} via PayNow
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-xl px-2.5 py-1">
                <span className="text-sm">&#128241;</span>
                <span className="text-xs font-bold text-red-600">PayNow</span>
              </div>
            </div>

            <div className="flex justify-center mb-5">
              <PayNowQR phone={toUser.paynow_number} amount={payAmount} onActivate={handleCopyPayNow} />
            </div>

            <button
              onClick={handleCopyPayNow}
              className="w-full py-4 bg-sky-500 text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ boxShadow: '0 4px 16px rgba(14,165,233,0.35)' }}
            >
              <span>&#128203;</span>
              Share / copy PayNow details
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-1">{iOwe ? 'Already paid outside the app?' : 'Already received payment outside the app?'}</p>
          <p className="text-xs text-gray-400 mb-3">
            This records the payment in Kaki Split. It does not verify the bank transfer.
          </p>
          <button
            disabled={Boolean(amountError) || recording || !canRecord || groupQuery.isFetching || (Boolean(groupQuery.error) && !pendingRequest)}
            onClick={() => { setConfirmation({ amount: payAmount, revision: group.ledger_revision }); setShowConfirm(true) }}
            className="w-full py-3.5 bg-gray-900 text-white rounded-full font-bold text-sm active:bg-gray-700 transition-colors"
          >
            {pendingRequest ? 'Retry original record' : `Record payment · ${formatMoney(payAmount, group?.base_currency)}`}
          </button>
        </div>
      </div>

      <BottomSheet isOpen={showConfirm} onClose={() => !recording && setShowConfirm(false)} confirmClose={() => !recordingRef.current} title="Record payment">
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            Record {formatMoney(pendingRequest?.amount ?? confirmation?.amount ?? payAmount, group.base_currency)} from {fromUser.display_name} to {toUser.display_name}? This updates the group balances and does not
            verify a bank transfer.
          </p>
          <button
            disabled={recording || Boolean(amountError)}
            onClick={handleMarkPaid}
            className="w-full min-h-11 rounded-2xl py-3 bg-sky-500 text-white font-bold disabled:opacity-50"
          >
            {recording ? 'Recording...' : 'Confirm record'}
          </button>
          <button
            disabled={recording}
            onClick={() => setShowConfirm(false)}
            className="w-full min-h-11 rounded-2xl py-3 bg-gray-100 text-gray-700 font-semibold"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>

      <BottomNav groupId={id} />
    </div>
  )
}
