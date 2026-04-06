import React, { useEffect, useMemo, useRef, useState } from 'react'
import Avatar from '../components/Avatar'
import ReceiptAssigner from '../components/ReceiptAssigner'
import { useReceiptScanner } from '../hooks/useReceiptScanner'
import { CATEGORIES, CURRENCIES, formatMoney } from '../lib/format'

const SPLIT_TYPES = [
  { id: 'equal', label: 'Equal' },
  { id: 'exact', label: 'Exact' },
  { id: 'percent', label: '%' },
]

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function sanitizeDecimalInput(value) {
  const next = String(value || '').replace(/[^0-9.]/g, '')
  if ((next.match(/\./g) || []).length > 1) return null
  return next
}

export default function QuickSplit({ members, currentUserId, onSubmit }) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('food')
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [splitMembers, setSplitMembers] = useState(members.map((member) => member.id))
  const [splitType, setSplitType] = useState('equal')
  const [splitValues, setSplitValues] = useState({})
  const [currency, setCurrency] = useState('SGD')
  const [showCurrency, setShowCurrency] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [showAssigner, setShowAssigner] = useState(false)
  const fileInputRef = useRef(null)
  const amountRef = useRef(null)
  const paidBySectionRef = useRef(null)
  const submitInFlightRef = useRef(false)
  const { scanReceipt, scanning, error: scanError, setError: setScanError } = useReceiptScanner()

  const focusPaidBySelection = () => {
    window.setTimeout(() => {
      const target = paidBySectionRef.current?.querySelector(`[data-paid-by="${paidBy}"]`)
      if (target instanceof HTMLElement) target.focus()
    }, 120)
  }

  useEffect(() => {
    window.setTimeout(() => amountRef.current?.focus(), 100)
  }, [])

  useEffect(() => {
    const allMemberIds = members.map((member) => member.id)
    setPaidBy(currentUserId)
    setSplitMembers(allMemberIds)
    setSplitValues((prev) => {
      const next = {}
      for (const id of allMemberIds) {
        next[id] = prev[id] || ''
      }
      return next
    })
  }, [currentUserId, members])

  const numericAmount = useMemo(() => Number(amount || 0), [amount])

  const selectedMembers = useMemo(
    () => members.filter((member) => splitMembers.includes(member.id)),
    [members, splitMembers]
  )

  const perPersonAmount = useMemo(() => {
    if (!numericAmount || splitMembers.length === 0) return '0.00'
    return (numericAmount / splitMembers.length).toFixed(2)
  }, [numericAmount, splitMembers.length])

  const exactSum = useMemo(() => {
    if (splitType !== 'exact') return 0
    return round2(selectedMembers.reduce((sum, member) => sum + Number(splitValues[member.id] || 0), 0))
  }, [splitType, selectedMembers, splitValues])

  const percentSum = useMemo(() => {
    if (splitType !== 'percent') return 0
    return round2(selectedMembers.reduce((sum, member) => sum + Number(splitValues[member.id] || 0), 0))
  }, [splitType, selectedMembers, splitValues])

  const splitValidationMessage = useMemo(() => {
    if (splitMembers.length === 0) return 'Choose at least one member'
    if (!numericAmount || numericAmount <= 0) return 'Enter a valid amount'
    if (splitType === 'exact' && exactSum !== round2(numericAmount)) {
      return `Exact amounts must total ${formatMoney(numericAmount, currency)}`
    }
    if (splitType === 'percent' && percentSum !== 100) {
      return 'Percentages must total 100%'
    }
    return null
  }, [currency, exactSum, numericAmount, percentSum, splitMembers.length, splitType])

  const canSubmit = Boolean(amount && description.trim() && !splitValidationMessage && !submitting)

  const toggleMember = (userId) => {
    setSplitMembers((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId)
      }
      return [...prev, userId]
    })
  }

  const handleSplitTypeChange = (nextType) => {
    setSplitType(nextType)

    if (nextType === 'equal') return

    if (nextType === 'percent') {
      const count = splitMembers.length
      if (count === 0) return
      const base = Math.floor((10000 / count)) / 100
      let remaining = round2(100 - base * count)
      setSplitValues((prev) => {
        const next = { ...prev }
        splitMembers.forEach((memberId, index) => {
          const value = round2(base + (index === count - 1 ? remaining : 0))
          next[memberId] = String(value)
          if (index === count - 1) remaining = 0
        })
        return next
      })
      return
    }

    if (nextType === 'exact' && numericAmount > 0 && splitMembers.length > 0) {
      const perMember = round2(numericAmount / splitMembers.length)
      let remaining = round2(numericAmount - perMember * splitMembers.length)
      setSplitValues((prev) => {
        const next = { ...prev }
        splitMembers.forEach((memberId, index) => {
          const value = round2(perMember + (index === splitMembers.length - 1 ? remaining : 0))
          next[memberId] = String(value)
          if (index === splitMembers.length - 1) remaining = 0
        })
        return next
      })
    }
  }

  const handleSplitValueChange = (userId, rawValue) => {
    const sanitized = sanitizeDecimalInput(rawValue)
    if (sanitized === null) return
    setSplitValues((prev) => ({ ...prev, [userId]: sanitized }))
  }

  const handleSubmit = async () => {
    if (!canSubmit || submitInFlightRef.current) return

    submitInFlightRef.current = true
    setSubmitting(true)
    try {
      const payloadSplitValues = splitMembers.reduce((acc, userId) => {
        acc[userId] = splitValues[userId] || '0'
        return acc
      }, {})

      await onSubmit({
        amount: parseFloat(amount),
        description: description.trim(),
        category,
        paid_by: paidBy,
        split_members: splitMembers,
        split_type: splitType,
        split_values: payloadSplitValues,
        currency,
      })
    } finally {
      submitInFlightRef.current = false
      setSubmitting(false)
    }
  }

  const handleReceiptUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const data = await scanReceipt(file)
    event.target.value = ''

    if (!data) return

    const scannedTotal = Number(data.total || 0)
    const scannedCurrency = String(data.currency || '').trim().toUpperCase()
    const scannedMerchant = String(data.merchant || '').trim()

    if (Number.isFinite(scannedTotal) && scannedTotal > 0) {
      setAmount(String(round2(scannedTotal)))
    }
    if (scannedCurrency) {
      setCurrency(scannedCurrency)
    }
    if (scannedMerchant && !description.trim()) {
      setDescription(scannedMerchant)
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      focusPaidBySelection()
      return
    }

    setReceiptData(data)
    setShowAssigner(true)
  }

  const handleAssignConfirm = (result) => {
    const nextDescription = String(result?.description || '').trim()
    const nextAmount = Number(result?.amount || 0)
    const nextCurrency = String(result?.currency || currency).toUpperCase()
    const nextSplits = Array.isArray(result?.splits) ? result.splits : []

    if (nextDescription) setDescription(nextDescription)
    if (Number.isFinite(nextAmount) && nextAmount > 0) setAmount(String(round2(nextAmount)))
    if (nextCurrency) setCurrency(nextCurrency)

    setSplitType('exact')
    setSplitMembers(nextSplits.map((item) => item.memberId))
    setSplitValues(
      nextSplits.reduce((acc, item) => {
        acc[item.memberId] = String(round2(item.amount))
        return acc
      }, {})
    )

    setShowAssigner(false)
    focusPaidBySelection()
  }

  return (
    <div className="flex flex-col">
        <div className="bg-sky-50 border-b border-sky-100 px-5 py-6 text-center">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Amount</p>
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setShowCurrency((value) => !value)} className="text-sky-600 font-bold text-2xl">
            {currency}
          </button>
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                const nextValue = sanitizeDecimalInput(event.target.value)
                if (nextValue !== null) setAmount(nextValue)
              }}
              placeholder="0.00"
              className="bg-transparent text-5xl font-black text-gray-900 text-center focus:outline-none w-44 placeholder-gray-300"
            />
        </div>
        {amount && splitMembers.length > 1 && splitType === 'equal' && (
          <p className="text-sky-600 text-sm font-medium mt-1">
            {formatMoney(perPersonAmount, currency)} each · {splitMembers.length} people
          </p>
        )}

        {showCurrency && (
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            {CURRENCIES.map((item) => (
              <button
                key={item.code}
                onClick={() => {
                  setCurrency(item.code)
                  setShowCurrency(false)
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${
                  currency === item.code ? 'bg-sky-500 text-white border-sky-500' : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                {item.code}
              </button>
            ))}
          </div>
        )}
      </div>

        <div className="px-5 py-4 space-y-5 pb-36">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setScanError(null)
                fileInputRef.current?.click()
              }}
              disabled={scanning}
              className="w-full py-3 rounded-2xl border border-sky-200 bg-sky-50 text-sky-700 font-semibold text-sm disabled:opacity-60"
            >
              {scanning ? 'Scanning receipt...' : '📷 Scan receipt'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleReceiptUpload}
              className="hidden"
            />
            {scanError && <p className="text-xs text-amber-600">Could not scan receipt: {scanError}</p>}
          </div>

          {showAssigner && receiptData && (
            <ReceiptAssigner
              receipt={receiptData}
              members={members}
              onConfirm={handleAssignConfirm}
              onCancel={() => setShowAssigner(false)}
            />
          )}

          <div>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What was this for?"
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
            />
          </div>


        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Category</p>
          <div className="flex gap-2">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                onClick={() => setCategory(item.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-2xl border-2 transition-all ${
                  category === item.id ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className={`text-[10px] font-semibold ${category === item.id ? 'text-sky-700' : 'text-gray-500'}`}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

          <div ref={paidBySectionRef}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Paid by</p>
            <div className="flex gap-2 flex-wrap">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  data-paid-by={member.id}
                  onClick={() => setPaidBy(member.id)}

                className={`flex items-center gap-2 px-3 py-2 rounded-2xl border-2 transition-all ${
                  paidBy === member.id ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white'
                }`}
              >
                <Avatar user={member} size="xs" ring={paidBy === member.id} />
                <span className={`text-sm font-semibold ${paidBy === member.id ? 'text-sky-700' : 'text-gray-600'}`}>
                  {member.id === currentUserId ? 'You' : member.display_name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Split between</p>
          <div className="flex gap-2 flex-wrap">
            {members.map((member) => {
              const included = splitMembers.includes(member.id)
              return (
                <button
                  key={member.id}
                  onClick={() => toggleMember(member.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-2xl border-2 transition-all ${
                    included ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white opacity-50'
                  }`}
                >
                  <Avatar user={member} size="xs" />
                  <span className={`text-sm font-semibold ${included ? 'text-sky-700' : 'text-gray-500'}`}>
                    {member.id === currentUserId ? 'You' : member.display_name}
                  </span>
                  {included && <span className="text-sky-500 text-xs">✓</span>}
                </button>
              )
            })}
          </div>
        </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Split type</p>
            <div className="flex bg-gray-100 rounded-2xl p-1">
              {SPLIT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleSplitTypeChange(type.id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    splitType === type.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {splitType !== 'equal' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  {splitType === 'exact' ? 'Exact amounts' : 'Percentages'}
                </p>
                <p className="text-xs font-semibold text-gray-400">
                  {splitType === 'exact'
                    ? `${formatMoney(exactSum, currency)} / ${formatMoney(numericAmount || 0, currency)}`
                    : `${percentSum.toFixed(2)}% / 100%`}
                </p>
              </div>

              <div className="space-y-2">
                {selectedMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5">
                    <Avatar user={member} size="xs" />
                    <span className="text-sm font-semibold text-gray-700 flex-1 min-w-0 truncate">
                      {member.id === currentUserId ? 'You' : member.display_name}
                    </span>
                    <div className="flex items-center gap-1">
                      {splitType === 'exact' && <span className="text-xs text-gray-400">{currency}</span>}
                      <input
                        type="text"
                        inputMode="decimal"
                        value={splitValues[member.id] || ''}
                        onChange={(event) => handleSplitValueChange(member.id, event.target.value)}
                        placeholder={splitType === 'exact' ? '0.00' : '0'}
                        className="w-20 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-right text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-300"
                      />
                      {splitType === 'percent' && <span className="text-xs text-gray-400">%</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {splitValidationMessage && (
            <p className="text-xs text-amber-600 font-medium -mt-1">{splitValidationMessage}</p>
          )}
        </div>

        <div
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 py-4 bg-white border-t border-gray-100 z-50"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-4 bg-sky-500 text-white rounded-2xl font-bold text-base disabled:opacity-40 transition-opacity"
            style={{ boxShadow: '0 4px 16px rgba(14, 165, 233, 0.3)' }}
          >
            {submitting ? 'Adding expense...' : `Add expense ${amount ? `· ${formatMoney(parseFloat(amount) || 0, currency)}` : ''}`}
          </button>

        </div>
    </div>
  )
}
