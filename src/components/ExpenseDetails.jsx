import { isGroupAdmin } from '../lib/groupPermissions'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import QuickSplit from '../pages/QuickSplit'
import { expenseToDraft } from '../lib/expenseReview'
import { fetchExpenseHistory } from '../lib/kakiSplitApi'
import { formatMoney } from '../lib/format'

function Snapshot({ snapshot, currency, usersById }) {
  const expense = snapshot.expense || {}
  return <div className="space-y-1 text-sm text-gray-600">
    <p className="break-words">{expense.description} · {formatMoney(expense.amount, currency)}</p>
    <p>Paid by {usersById[expense.paid_by]?.display_name || 'Former member'} · {expense.category || 'other'}</p>
    {(snapshot.splits || []).map((split) => <p key={split.user_id}>{usersById[split.user_id]?.display_name || 'Former member'}: {formatMoney(split.amount, currency)}</p>)}
    {Number(expense.original_amount) > 0 && <p>Original: {formatMoney(expense.original_amount, expense.original_currency)} · rate {expense.exchange_rate}</p>}
  </div>
}

export default function ExpenseDetails({ expense, group, members, usersById, currentUserId, paymentsExist, onSave, onDraftChange }) {
  const [editing, setEditing] = useState(false)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const draftRef = useRef({ dirty: false, busy: false })
  const backRef = useRef(null)
  const editRef = useRef(null)
  const previousEditing = useRef(false)
  const initialValues = useMemo(() => expenseToDraft(expense, group.base_currency), [expense, group.base_currency])
  const canEdit = expense.created_by === currentUserId || isGroupAdmin(group, currentUserId, members)
  const currency = group.base_currency || 'SGD'
  const converted = Number(expense.original_amount) > 0 && expense.original_currency !== currency
  const draftChanged = React.useCallback((value) => { draftRef.current = value; onDraftChange?.(value) }, [onDraftChange])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    // A revision change reloads the audit trail after a successful correction.
    fetchExpenseHistory(expense.id).then((data) => { if (active) setHistory(data) }).catch((failure) => {
      if (active) setError(failure.message)
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [expense.id, expense.revision, reload])

  useEffect(() => { if (!editing) draftChanged({ dirty: false, busy: false }) }, [editing, draftChanged])
  useEffect(() => {
    // Replacing the view must not leave keyboard focus on the document body.
    if (editing !== previousEditing.current) (editing ? backRef : editRef).current?.focus()
    previousEditing.current = editing
  }, [editing])

  if (editing) return <div>
    <div className="px-5 pt-4 space-y-2">
      <button ref={backRef} type="button" className="text-sm font-semibold text-sky-700" onClick={() => {
        if (!draftRef.current.busy && (!draftRef.current.dirty || window.confirm('Discard this unfinished correction?'))) setEditing(false)
      }}>Back to expense details</button>
      <p className="text-sm text-gray-600">Corrections update balances and keep a before-and-after history.</p>
      {expense.split_type === 'percent' && <p className="text-sm text-gray-600">Saved percentage shares are shown as exact amounts. You can switch back to percentages.</p>}
      {converted && <p className="text-sm text-gray-600">Keeping {expense.original_currency} preserves the saved exchange rate. Changing currency uses a new quote.</p>}
      {paymentsExist && <p role="status" className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">Payments already exist. This correction may change what remains owed; recorded payments will stay in the ledger.</p>}
    </div>
    <QuickSplit key={`${expense.id}:${expense.revision}`} members={members} currentUserId={currentUserId} baseCurrency={currency} savedExpense={expense} initialValues={initialValues} onDraftChange={draftChanged}
      onSubmit={async (payload) => { const saved = await onSave(expense, payload); if (saved !== false) setEditing(false); return saved }} />
  </div>

  return <div className="px-5 py-4 space-y-5">
    <div><h2 className="text-xl font-bold text-gray-900 break-words">{expense.description}</h2><p className="text-2xl font-black text-sky-700 mt-2">{formatMoney(expense.amount, currency)}</p></div>
    <dl className="space-y-2 text-sm text-gray-600">
      <div><dt className="font-semibold">Paid by</dt><dd>{usersById[expense.paid_by]?.display_name || 'Former member'}</dd></div>
      <div><dt className="font-semibold">Recorded by</dt><dd>{usersById[expense.created_by]?.display_name || 'Former member'}</dd></div>
      <div><dt className="font-semibold">Category / split</dt><dd>{expense.category || 'other'} · {expense.split_type}</dd></div>
      {expense.created_at && <div><dt className="font-semibold">Recorded</dt><dd>{new Date(expense.created_at).toLocaleString('en-SG')}</dd></div>}
    </dl>
    {converted && <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-gray-700 space-y-1">
      <p>Original total: {formatMoney(expense.original_amount, expense.original_currency)}</p>
      <p>1 {expense.original_currency} = {expense.exchange_rate} {currency}</p>
      <p>Rate date: {expense.exchange_rate_date || 'Not recorded'} · source: {expense.exchange_rate_source || 'Not recorded'}</p>
      <p className="text-xs">This saved rate is used for balances; it may differ from your bank's rate.</p>
    </div>}
    <section><h3 className="font-bold text-gray-900 mb-2">Allocated shares</h3>
      {(expense.splits || []).map((split) => <div key={split.user_id} className="flex justify-between gap-3 py-2 text-sm text-gray-700 border-b border-gray-100"><span className="break-words">{usersById[split.user_id]?.display_name || 'Former member'}</span><span className="shrink-0 font-semibold">{formatMoney(split.amount, currency)}</span></div>)}
    </section>
    {canEdit ? <button ref={editRef} type="button" onClick={() => setEditing(true)} className="w-full rounded-2xl bg-sky-500 py-3 text-white font-bold">Edit expense</button> : <p className="text-sm text-gray-500">Only the recorder or a group admin can edit this expense.</p>}
    <section><h3 className="font-bold text-gray-900 mb-2">Change history</h3>
      {loading ? <p role="status" className="text-sm text-gray-500">Loading history...</p> : error ? <div role="alert" className="text-sm text-red-600"><p>{error}</p><button type="button" onClick={() => setReload((value) => value + 1)} className="font-semibold">Retry history</button></div> : history.length === 0 ? <p className="text-sm text-gray-500">No corrections recorded.</p> : history.map((entry) => <details key={entry.id} className="rounded-xl border border-gray-200 p-3 mb-2">
        <summary className="text-sm font-semibold text-gray-700 cursor-pointer">Revision {entry.revision} · {usersById[entry.actor_user_id]?.display_name || 'Former member'} · {new Date(entry.created_at).toLocaleString('en-SG')}</summary>
        <div className="mt-3 space-y-3"><div><p className="text-xs font-bold text-gray-500 mb-1">BEFORE</p><Snapshot snapshot={entry.before_snapshot} currency={currency} usersById={usersById} /></div><div><p className="text-xs font-bold text-gray-500 mb-1">AFTER</p><Snapshot snapshot={entry.after_snapshot} currency={currency} usersById={usersById} /></div></div>
      </details>)}
    </section>
  </div>
}
