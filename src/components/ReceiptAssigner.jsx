import React, { useMemo, useState } from 'react'
import { formatMoney } from '../lib/format'

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

export default function ReceiptAssigner({ receipt, members, onConfirm, onCancel }) {
  const [assignments, setAssignments] = useState({})

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
      const perPerson = Number(item.amount || 0) / assigned.length
      assigned.forEach((memberId) => {
        totals[memberId] = round2((totals[memberId] || 0) + perPerson)
      })
    })

    const extras = round2(Number(receipt?.tax || 0) + Number(receipt?.service_charge || 0) - Number(receipt?.discount || 0))
    const subtotal = round2(Object.values(totals).reduce((sum, amount) => sum + Number(amount || 0), 0))

    if (subtotal > 0 && extras !== 0) {
      const memberIds = members.map((m) => m.id)
      let distributed = 0
      memberIds.forEach((memberId, index) => {
        const current = Number(totals[memberId] || 0)
        const share = index === memberIds.length - 1 ? round2(extras - distributed) : round2(extras * (current / subtotal))
        totals[memberId] = round2(current + share)
        distributed = round2(distributed + share)
      })
    }

    return totals
  }, [assignments, items, members, receipt])

  const allAssigned = items.length > 0 && items.every((item) => (assignments[item.id] || []).length > 0)

  function handleConfirm() {
    const splits = members.map((member) => ({
      memberId: member.id,
      amount: round2(splitMap[member.id] || 0),
    }))

    const totalFromSplits = round2(splits.reduce((sum, item) => sum + Number(item.amount || 0), 0))
    const targetTotal = round2(receipt?.total || totalFromSplits)
    const diff = round2(targetTotal - totalFromSplits)

    if (splits.length > 0 && diff !== 0) {
      const maxIndex = splits.reduce((bestIndex, current, idx, arr) => (current.amount > arr[bestIndex].amount ? idx : bestIndex), 0)
      splits[maxIndex] = {
        ...splits[maxIndex],
        amount: round2(Number(splits[maxIndex].amount || 0) + diff),
      }
    }

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
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Scanned receipt</p>
          <h3 className="text-base font-bold text-gray-900 mt-1">{receipt?.merchant || 'Receipt'}</h3>
          <p className="text-xs text-gray-500 mt-1">Tap names for each item ordered</p>
        </div>
        <p className="text-sm font-bold text-sky-700">{formatMoney(receipt?.total || 0, currency)}</p>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
              <p className="text-sm font-bold text-gray-900">{formatMoney(item.amount, currency)}</p>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {members.map((member) => {
                const selected = (assignments[item.id] || []).includes(member.id)
                return (
                  <button
                    key={`${item.id}-${member.id}`}
                    type="button"
                    onClick={() => toggleAssignment(item.id, member.id)}
                    className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                      selected ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {(member.display_name || member.name || member.id).split(' ')[0]}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {(Number(receipt?.tax || 0) > 0 || Number(receipt?.service_charge || 0) > 0 || Number(receipt?.discount || 0) > 0) && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          <p>
            Extras distributed proportionally: tax {formatMoney(receipt?.tax || 0, currency)} + service {formatMoney(receipt?.service_charge || 0, currency)}
            {Number(receipt?.discount || 0) > 0 ? ` - discount ${formatMoney(receipt?.discount || 0, currency)}` : ''}
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 space-y-1.5">
        {members.map((member) => (
          <div key={`sum-${member.id}`} className="flex items-center justify-between text-sm">
            <span className="text-gray-700">{member.display_name || member.name || member.id}</span>
            <span className="font-semibold text-sky-700">{formatMoney(splitMap[member.id] || 0, currency)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-full border border-gray-200 text-gray-700 font-semibold text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!allAssigned}
          className="flex-1 py-3 rounded-full bg-sky-500 text-white font-bold text-sm disabled:opacity-50"
        >
          Confirm split
        </button>
      </div>
    </div>
  )
}
