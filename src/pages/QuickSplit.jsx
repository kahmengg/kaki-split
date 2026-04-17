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

function toCents(value) {
  return Math.round(Number(value || 0) * 100)
}

function splitItemCents(itemCents, memberIds) {
  if (!Array.isArray(memberIds) || memberIds.length === 0 || itemCents <= 0) return []
  const base = Math.floor(itemCents / memberIds.length)
  const remainder = itemCents - base * memberIds.length

  return memberIds.map((memberId, index) => ({
    memberId,
    cents: base + (index < remainder ? 1 : 0),
  }))
}

function sanitizeDecimalInput(value) {
  const next = String(value || '').replace(/[^0-9.]/g, '')
  if ((next.match(/\./g) || []).length > 1) return null
  return next
}

function createSharedItem(seed, memberIds = []) {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${seed}`,
    name: '',
    amount: '',
    memberIds: Array.isArray(memberIds) ? memberIds : [],
  }
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
  const [useItemizedSplit, setUseItemizedSplit] = useState(false)
  const [sharedItems, setSharedItems] = useState([])
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
    setSharedItems((prev) =>
      prev.map((item, index) => ({
        ...item,
        memberIds: (item.memberIds || []).filter((memberId) => allMemberIds.includes(memberId)),
        id: item.id || createSharedItem(index + 1).id,
      }))
    )
  }, [currentUserId, members])

  const numericAmount = useMemo(() => Number(amount || 0), [amount])
  const allMemberIds = useMemo(() => members.map((member) => member.id), [members])

  const itemizedPreview = useMemo(() => {
    if (!useItemizedSplit) {
      return {
        splitMembers: [],
        splitValues: {},
        total: 0,
        missingMemberItems: 0,
        missingAmountItems: 0,
        hasInvalidAmount: false,
      }
    }

    const totalsByMemberCents = {}
    let totalCents = 0
    let missingMemberItems = 0
    let missingAmountItems = 0
    let hasInvalidAmount = false

    for (const item of sharedItems) {
      const normalizedAmount = String(item.amount || '').trim()
      if (!normalizedAmount) {
        missingAmountItems += 1
        continue
      }

      const amountValue = Number(normalizedAmount)
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        hasInvalidAmount = true
        continue
      }

      const selected = (item.memberIds || []).filter((memberId) => allMemberIds.includes(memberId))
      if (selected.length === 0) {
        missingMemberItems += 1
        continue
      }

      const itemCents = toCents(amountValue)
      totalCents += itemCents

      for (const split of splitItemCents(itemCents, selected)) {
        totalsByMemberCents[split.memberId] = (totalsByMemberCents[split.memberId] || 0) + split.cents
      }
    }

    const splitMemberIds = Object.keys(totalsByMemberCents).filter((memberId) => totalsByMemberCents[memberId] > 0)
    const splitValues = splitMemberIds.reduce((acc, memberId) => {
      acc[memberId] = (totalsByMemberCents[memberId] / 100).toFixed(2)
      return acc
    }, {})

    return {
      splitMembers: splitMemberIds,
      splitValues,
      total: totalCents / 100,
      missingMemberItems,
      missingAmountItems,
      hasInvalidAmount,
    }
  }, [allMemberIds, sharedItems, useItemizedSplit])

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
    if (useItemizedSplit) {
      if (sharedItems.length === 0) return 'Add at least one item'
      if (itemizedPreview.missingAmountItems > 0) return 'Enter an amount for each item'
      if (itemizedPreview.hasInvalidAmount) return 'Item amounts must be greater than 0'
      if (itemizedPreview.missingMemberItems > 0) return 'Choose at least one person for each item'
      if (itemizedPreview.splitMembers.length === 0 || itemizedPreview.total <= 0) return 'Add item amounts to continue'
      if (Math.abs(round2(itemizedPreview.total) - round2(numericAmount)) > 0.01) {
        return `Item total must match ${formatMoney(numericAmount, currency)}`
      }
      return null
    }

    if (splitMembers.length === 0) return 'Choose at least one member'
    if (!numericAmount || numericAmount <= 0) return 'Enter a valid amount'
    if (splitType === 'exact' && exactSum !== round2(numericAmount)) {
      return `Exact amounts must total ${formatMoney(numericAmount, currency)}`
    }
    if (splitType === 'percent' && percentSum !== 100) {
      return 'Percentages must total 100%'
    }
    return null
  }, [
    currency,
    exactSum,
    itemizedPreview.hasInvalidAmount,
    itemizedPreview.missingAmountItems,
    itemizedPreview.missingMemberItems,
    itemizedPreview.splitMembers.length,
    itemizedPreview.total,
    numericAmount,
    percentSum,
    sharedItems.length,
    splitMembers.length,
    splitType,
    useItemizedSplit,
  ])

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

  const toggleSharedItemMember = (itemId, userId) => {
    setSharedItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        const memberIds = Array.isArray(item.memberIds) ? item.memberIds : []
        const included = memberIds.includes(userId)
        return {
          ...item,
          memberIds: included ? memberIds.filter((id) => id !== userId) : [...memberIds, userId],
        }
      })
    )
  }

  const handleSharedItemChange = (itemId, key, rawValue) => {
    if (key === 'amount') {
      const sanitized = sanitizeDecimalInput(rawValue)
      if (sanitized === null) return
      setSharedItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, amount: sanitized } : item)))
      return
    }

    setSharedItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, [key]: rawValue } : item)))
  }

  const addSharedItemRow = () => {
    setSharedItems((prev) => [...prev, createSharedItem(prev.length + 1)])
  }

  const removeSharedItemRow = (itemId) => {
    setSharedItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  const applyItemizedMode = () => {
    setUseItemizedSplit(true)
    setSplitType('exact')
    setSharedItems((prev) => (prev.length > 0 ? prev : [createSharedItem(1)]))
  }

  const disableItemizedMode = () => {
    setUseItemizedSplit(false)
  }

  const handleSubmit = async () => {
    if (!canSubmit || submitInFlightRef.current) return

    submitInFlightRef.current = true
    setSubmitting(true)
    try {
      const activeSplitMembers = useItemizedSplit ? itemizedPreview.splitMembers : splitMembers
      const activeSplitValues = useItemizedSplit ? itemizedPreview.splitValues : splitValues
      const payloadSplitValues = activeSplitMembers.reduce((acc, userId) => {
        acc[userId] = activeSplitValues[userId] || '0'
        return acc
      }, {})

      await onSubmit({
        amount: parseFloat(amount),
        description: description.trim(),
        category,
        paid_by: paidBy,
        split_members: activeSplitMembers,
        split_type: useItemizedSplit ? 'exact' : splitType,
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

    setUseItemizedSplit(false)
    setSharedItems([])
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
          {!useItemizedSplit && amount && splitMembers.length > 1 && splitType === 'equal' && (
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
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">How to split</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={disableItemizedMode}
                className={`py-2.5 rounded-2xl border-2 text-sm font-semibold transition ${
                  !useItemizedSplit ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                Simple split
              </button>
              <button
                type="button"
                onClick={applyItemizedMode}
                className={`py-2.5 rounded-2xl border-2 text-sm font-semibold transition ${
                  useItemizedSplit ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                By items
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {useItemizedSplit ? 'Great for dishes like fries shared by specific people.' : 'Split the full total directly.'}
            </p>
          </div>

          {useItemizedSplit ? (
            <div className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Shared items</p>
                <button
                  type="button"
                  onClick={addSharedItemRow}
                  className="px-3 py-1.5 rounded-full bg-white border border-sky-200 text-sky-700 text-xs font-semibold"
                >
                  + Add item
                </button>
              </div>

              {sharedItems.length === 0 ? (
                <button
                  type="button"
                  onClick={addSharedItemRow}
                  className="w-full py-3 rounded-2xl border border-dashed border-sky-300 text-sky-700 text-sm font-semibold bg-white"
                >
                  Add first item
                </button>
              ) : (
                <div className="space-y-2">
                  {sharedItems.map((item, index) => (
                    <div key={item.id} className="rounded-2xl bg-white border border-sky-100 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(event) => handleSharedItemChange(item.id, 'name', event.target.value)}
                          placeholder={`Item ${index + 1} (e.g. Fries)`}
                          className="flex-1 min-w-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
                        />
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-xl">
                          <span className="text-[10px] text-gray-500 font-semibold">{currency}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.amount}
                            onChange={(event) => handleSharedItemChange(item.id, 'amount', event.target.value)}
                            placeholder="0.00"
                            className="w-16 bg-transparent text-right text-sm font-semibold text-gray-800 focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSharedItemRow(item.id)}
                          className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 text-sm"
                          aria-label={`Remove item ${index + 1}`}
                        >
                          ✕
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {members.map((member) => {
                          const selected = (item.memberIds || []).includes(member.id)
                          return (
                            <button
                              key={`${item.id}-${member.id}`}
                              type="button"
                              onClick={() => toggleSharedItemMember(item.id, member.id)}
                              className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                                selected ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-600'
                              }`}
                            >
                              {member.id === currentUserId ? 'You' : member.display_name.split(' ')[0]}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border border-sky-100 bg-white p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                  <span>Items total</span>
                  <span>{formatMoney(itemizedPreview.total, currency)}</span>
                </div>
                {members
                  .filter((member) => itemizedPreview.splitMembers.includes(member.id))
                  .map((member) => (
                    <div key={`itemized-preview-${member.id}`} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{member.id === currentUserId ? 'You' : member.display_name}</span>
                      <span className="font-semibold text-sky-700">{formatMoney(Number(itemizedPreview.splitValues[member.id] || 0), currency)}</span>
                    </div>
                  ))}
                <button
                  type="button"
                  onClick={() => setAmount(itemizedPreview.total ? String(round2(itemizedPreview.total)) : '')}
                  className="w-full mt-1 py-2 rounded-xl border border-sky-200 text-sky-700 text-xs font-semibold"
                >
                  Use items total as amount
                </button>
              </div>
            </div>
          ) : (
            <>
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
            </>
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
