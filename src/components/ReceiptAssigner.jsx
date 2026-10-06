import React, { useEffect, useMemo, useState } from 'react'
import { CURRENCIES, formatMoney } from '../lib/format'

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function allocateCents(cents, weights) {
  const sum = weights.reduce((total, value) => total + value, 0)
  if (!sum) return weights.map(() => 0)
  const absolute = Math.abs(cents)
  const exact = weights.map((weight) => absolute * weight / sum)
  const allocations = exact.map(Math.floor)
  let remainder = absolute - allocations.reduce((total, value) => total + value, 0)
  // Largest remainders distribute rounding only among actual participants.
  const order = exact.map((value, index) => index).filter((index) => weights[index] > 0).sort((a, b) => (exact[b] - allocations[b]) - (exact[a] - allocations[a]) || a - b)
  for (const index of order) { if (remainder-- <= 0) break; allocations[index] += 1 }
  return allocations.map((value) => value * Math.sign(cents))
}

export default function ReceiptAssigner({ receipt: scannedReceipt, members, onConfirm, onCancel, initialDraft, onDraftChange }) {
  const [assignments, setAssignments] = useState(initialDraft?.assignments || {})
  const [receipt, setReceipt] = useState(initialDraft?.receipt || scannedReceipt)
  const [acceptDifference, setAcceptDifference] = useState(false)

  useEffect(() => { onDraftChange?.({ receipt, assignments }) }, [receipt, assignments, onDraftChange])
  useEffect(() => {
    const allowed = new Set(members.map(member => member.id))
    setAssignments(previous => Object.fromEntries(Object.entries(previous).map(([id, values]) => [id, values.filter(value => allowed.has(value))])))
  }, [members])

  const items = Array.isArray(receipt?.items) ? receipt.items : []
  const currency = receipt?.currency || 'SGD'

  function toggleAssignment(itemId, memberId) {
    setAssignments((prev) => {
      const current = prev[itemId] || []
      const hasMember = current.includes(memberId)
      return {
        ...prev,
        [itemId]: hasMember ? current.filter((id) => id !== memberId) : [...current, memberId],
      }
    })
  }

  const splitMap = useMemo(() => {
    const totals = {}
    members.forEach((member) => {
      totals[member.id] = 0
    })

    items.forEach((item) => {
      const assigned = assignments[item.id] || []
      if (assigned.length === 0) return
      const amounts = allocateCents(Math.round(Number(item.amount || 0) * 100), assigned.map(() => 1))
      assigned.forEach((memberId, index) => { totals[memberId] += amounts[index] / 100 })
    })

    const extras = round2(
      Number(receipt?.tax || 0) + Number(receipt?.service_charge || 0) - Number(receipt?.discount || 0),
    )
    const subtotal = round2(Object.values(totals).reduce((sum, amount) => sum + Number(amount || 0), 0))

    if (subtotal > 0 && extras !== 0) {
      const memberIds = members.map((m) => m.id)
      const portions = allocateCents(Math.round(extras * 100), memberIds.map((id) => Math.round(totals[id] * 100)))
      memberIds.forEach((memberId, index) => {
        const current = Number(totals[memberId] || 0)
        totals[memberId] = round2(current + portions[index] / 100)
      })
    }

    return totals
  }, [assignments, items, members, receipt])

  const allAssigned = items.length > 0 && items.every((item) => (assignments[item.id] || []).length > 0)

  // Preview uses the same corrected amounts that confirmation submits.
  const preview = useMemo(() => {
    const splits = members.map((member) => ({
      memberId: member.id,
      amount: round2(splitMap[member.id] || 0),
    }))

    const totalFromSplits = round2(splits.reduce((sum, item) => sum + Number(item.amount || 0), 0))
    const targetTotal = round2(receipt?.total || totalFromSplits)
    const diff = round2(targetTotal - totalFromSplits)

    if (splits.length > 0 && diff !== 0) {
      const maxIndex = splits.reduce(
        (bestIndex, current, idx, arr) => (current.amount > arr[bestIndex].amount ? idx : bestIndex),
        0,
      )
      splits[maxIndex] = {
        ...splits[maxIndex],
        amount: round2(Number(splits[maxIndex].amount || 0) + diff),
      }
    }

    return { splits, targetTotal, diff }
  }, [splitMap, receipt, members])

  useEffect(() => setAcceptDifference(false), [splitMap])
  const largeDifference = Math.abs(preview.diff) > 0.01
  const validAmounts =
    preview.targetTotal > 0 &&
    preview.splits.every((split) => Number.isFinite(split.amount) && split.amount >= 0) &&
    items.every((item) => Number(item.amount) > 0 && String(item.name || '').trim())

  function handleConfirm() {
    if (!allAssigned || !validAmounts || (largeDifference && !acceptDifference)) return
    const { splits, targetTotal } = preview
    onConfirm({
      description: receipt?.merchant || 'Receipt expense',
      amount: targetTotal,
      currency,
      splitType: 'exact',
      splits,
    })
  }

  return (
    <div className="space-y-4 rounded-2xl border border-sky-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-700">Review receipt</p>
          <h3 className="text-base font-bold text-gray-900 mt-1">{receipt?.merchant || 'Receipt'}</h3>
          <p className="text-xs text-gray-500 mt-1">Check the extracted details, then tap names for each item. Nothing is saved until you add the expense.</p>
        </div>
        <p className="text-sm font-bold text-sky-700">{formatMoney(receipt?.total || 0, currency)}</p>
      </div>

      <label className="block text-sm font-semibold text-gray-700">
        Merchant / description
        <input value={receipt.merchant || ''} onChange={(event) => setReceipt((previous) => ({ ...previous, merchant: event.target.value }))} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3" />
      </label>
      <label className="block text-sm font-semibold text-gray-700">
        Receipt currency
        <select value={currency} onChange={(event) => setReceipt((previous) => ({ ...previous, currency: event.target.value }))} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3">
          {CURRENCIES.map((entry) => <option key={entry.code} value={entry.code}>{entry.code} — {entry.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold text-gray-700">
        Receipt total ({currency})
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={receipt.total}
          onChange={(event) => setReceipt((prev) => ({ ...prev, total: event.target.value }))}
          className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3"
        />
      </label>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <input aria-label={`Item ${items.indexOf(item) + 1} name`} value={item.name} onChange={(event) => setReceipt((previous) => ({ ...previous, items: previous.items.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry) }))} className="min-w-0 flex-1 rounded-lg border border-gray-200 p-2 text-sm font-semibold text-gray-800" />
              <input
                aria-label={`${item.name} amount in ${currency}`}
                type="number"
                min="0.01"
                step="0.01"
                value={item.amount}
                onChange={(event) =>
                  setReceipt((prev) => ({
                    ...prev,
                    items: prev.items.map((entry) =>
                      entry.id === item.id ? { ...entry, amount: event.target.value } : entry,
                    ),
                  }))
                }
                className="w-24 shrink-0 rounded-lg border border-gray-200 p-2 text-right"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {members.map((member) => {
                const selected = (assignments[item.id] || []).includes(member.id)
                return (
                  <button
                    key={`${item.id}-${member.id}`}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${member.display_name || member.name}, ${item.name}`}
                    onClick={() => toggleAssignment(item.id, member.id)}
                    className={`min-h-11 px-3 py-2 rounded-full text-xs font-semibold border transition ${
                      selected ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {member.display_name || member.name || member.id}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {(Number(receipt?.tax || 0) > 0 ||
        Number(receipt?.service_charge || 0) > 0 ||
        Number(receipt?.discount || 0) > 0) && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          <p>
            Extras distributed proportionally: tax {formatMoney(receipt?.tax || 0, currency)} + service{' '}
            {formatMoney(receipt?.service_charge || 0, currency)}
            {Number(receipt?.discount || 0) > 0 ? ` - discount ${formatMoney(receipt?.discount || 0, currency)}` : ''}
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 space-y-1.5">
        {members.map((member) => (
          <div key={`sum-${member.id}`} className="flex items-center justify-between text-sm">
            <span className="text-gray-700">{member.display_name || member.name || member.id}</span>
            <span className="font-semibold text-sky-700">
              {formatMoney(preview.splits.find((split) => split.memberId === member.id)?.amount || 0, currency)}
            </span>
          </div>
        ))}
      </div>

      <details>
        <summary className="min-h-11 text-sm font-semibold text-gray-700 cursor-pointer">
          Edit tax, service charge, or discount
        </summary>
        <div className="space-y-3">
          {[
            ['tax', 'Tax'],
            ['service_charge', 'Service charge'],
            ['discount', 'Discount'],
          ].map(([key, label]) => (
            <label key={key} className="block text-sm text-gray-700">
              {label}
              <input
                type="number"
                min="0"
                step="0.01"
                value={receipt[key] || 0}
                onChange={(event) => setReceipt((prev) => ({ ...prev, [key]: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 p-3"
              />
            </label>
          ))}
        </div>
      </details>
      {!allAssigned && (
        <p role="status" className="text-sm text-gray-600">
          Assign every item to at least one person.
        </p>
      )}
      {allAssigned && largeDifference && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <p>
            The receipt total differs from items and extras by {formatMoney(Math.abs(preview.diff), currency)}. Check
            the scanned amounts above, or explicitly apply the difference to the largest share shown in the preview.
          </p>
          <label className="flex items-center gap-3 mt-2 min-h-11">
            <input
              type="checkbox"
              checked={acceptDifference}
              onChange={(event) => setAcceptDifference(event.target.checked)}
            />
            Apply this difference to the largest share
          </label>
        </div>
      )}
      {!validAmounts && (
        <p role="alert" className="text-sm text-red-600">
          Enter positive item amounts and a total that leaves every share nonnegative.
        </p>
      )}
      <div className="sticky bottom-0 bg-white flex items-center gap-2 py-3 safe-bottom">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-full border border-gray-200 text-gray-700 font-semibold text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!allAssigned || !validAmounts || (largeDifference && !acceptDifference)}
          className="flex-1 py-3 rounded-full bg-sky-500 text-white font-bold text-sm disabled:opacity-50"
        >
          Use these splits
        </button>
      </div>
    </div>
  )
}
