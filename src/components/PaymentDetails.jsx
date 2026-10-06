import { isGroupAdmin } from '../lib/groupPermissions'
import React, { useEffect, useRef, useState } from 'react'
import { fetchPaymentHistory } from '../lib/kakiSplitApi'
import { formatMoney } from '../lib/format'

export default function PaymentDetails({ payment, group, usersById, currentUserId, onChange, onDraftChange, startCorrection = false }) {
  const [history, setHistory] = useState([])
  const [historyError, setHistoryError] = useState('')
  const [historyLoading, setHistoryLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [showVoid, setShowVoid] = useState(startCorrection)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changingRef = useRef(false)
  const name = id => usersById[id]?.display_name || 'Member'
  const canVoid = payment.created_by === currentUserId || isGroupAdmin(group, currentUserId, usersById)
  useEffect(() => {
    // Ignore history responses for a record that has since closed or changed.
    let cancelled = false
    setHistoryLoading(true)
    setHistoryError('')
    fetchPaymentHistory(payment.id).then(rows => { if (!cancelled) setHistory(rows) }).catch(() => { if (!cancelled) setHistoryError('Unable to load change history.') }).finally(() => { if (!cancelled) setHistoryLoading(false) })
    return () => { cancelled = true }
  }, [payment.id, payment.revision, reload])
  useEffect(() => { onDraftChange?.({ dirty: Boolean(reason.trim()), busy }) }, [reason, busy, onDraftChange])
  const change = async action => {
    if (changingRef.current) return
    changingRef.current = true
    setBusy(true)
    setError('')
    try {
      await onChange({ payment, action, reason })
      if (action === 'void') { setReason(''); setShowVoid(false) }
    } catch (failure) { setError(failure.message || 'Unable to update the record. Try again.') }
    finally { changingRef.current = false; setBusy(false) }
  }
  return <div className="px-5 py-4 space-y-4">
    <p className="text-2xl font-black text-gray-900">{formatMoney(payment.amount, group.base_currency)}</p>
    <dl className="text-sm text-gray-700 space-y-2">
      <div><dt className="font-semibold">From → to</dt><dd>{name(payment.from_user_id)} → {name(payment.to_user_id)}</dd></div>
      <div><dt className="font-semibold">Recorded by</dt><dd>{name(payment.created_by)} · {new Date(payment.created_at).toLocaleString('en-SG')}</dd></div>
      <div><dt className="font-semibold">Receipt status</dt><dd>{payment.voided_at ? 'Voided — excluded from balances' : payment.acknowledged_at ? `${name(payment.to_user_id)} acknowledged receipt on ${new Date(payment.acknowledged_at).toLocaleString('en-SG')}` : 'Not acknowledged by the recipient'}</dd></div>
    </dl>
    <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">This is a manual record. Receipt acknowledgement is optional and does not verify a bank transfer.</p>
    {payment.voided_at && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Voided by {name(payment.voided_by)}: {payment.void_reason}. To correct the amount, record a new payment from the updated group balance.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!payment.voided_at && !payment.acknowledged_at && payment.to_user_id === currentUserId && <button disabled={busy} onClick={() => change('acknowledge')} className="w-full rounded-2xl bg-sky-500 text-white py-3 font-bold disabled:opacity-60">{busy ? 'Saving…' : 'Acknowledge receipt'}</button>}
    {!payment.voided_at && canVoid && (showVoid ? <div className="space-y-3 rounded-2xl border border-amber-200 p-4">
      <p className="text-sm text-gray-700">Voiding reverses this record's effect on balances. It keeps the original record and its history, including any receipt acknowledgement.</p>
      <label htmlFor="payment-void-reason" className="block text-sm font-semibold text-gray-700">Reason for voiding</label>
      <textarea id="payment-void-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={300} className="w-full rounded-xl border border-gray-300 p-3 text-gray-900 bg-white" />
      <button disabled={busy || reason.trim().length < 3} onClick={() => change('void')} className="w-full rounded-xl py-3 font-bold bg-amber-100 text-amber-900 disabled:opacity-60">{busy ? 'Saving…' : 'Void this record'}</button>
      <button disabled={busy} onClick={() => { setShowVoid(false); setReason('') }} className="w-full py-3 text-gray-600 font-semibold">Cancel</button>
    </div> : <button onClick={() => setShowVoid(true)} className="w-full rounded-2xl border border-amber-300 text-amber-800 py-3 font-bold">Correct a mistaken record</button>)}
    <section aria-label="Payment change history" className="border-t border-gray-200 pt-4">
      <h3 className="font-bold text-gray-900 mb-2">Change history</h3>
      {historyLoading ? <p role="status" className="text-sm text-gray-600">Loading history…</p> : historyError ? <div role="alert"><p className="text-sm text-red-700">{historyError}</p><button onClick={() => setReload(value => value + 1)} className="font-bold py-3 text-sky-700">Try again</button></div> : history.length ? <ol className="space-y-3">{history.map(entry => <li key={entry.id} className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700"><p className="font-semibold">{entry.action === 'void' ? 'Record voided' : 'Receipt acknowledged'} by {name(entry.actor_user_id)}</p><p>{new Date(entry.created_at).toLocaleString('en-SG')}</p>{entry.action === 'void' && <p>{entry.after_snapshot.void_reason}</p>}</li>)}</ol> : <p className="text-sm text-gray-600">No changes to this record.</p>}
    </section>
  </div>
}
