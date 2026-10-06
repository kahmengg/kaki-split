import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fetchExpenseQuote } from '../lib/kakiSplitApi'
import { quoteMatches, quoteNeedsNotice } from '../lib/expenseQuotes'
import { convertedExpenseAmount } from '../lib/expenseReview'
import { readExpenseRequest, rememberExpenseRequest, forgetExpenseRequest, requestToDraft } from '../lib/expenseRequests'
import { readDraft, writeDraft, clearDraft } from '../lib/expenseDrafts'
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

export default function QuickSplit({ members, currentUserId, onSubmit, baseCurrency = 'SGD', onDraftChange, initialValues, groupId, expenseId, expenseRevision = 0, savedExpense = null }) {
  const [conversion, setConversion] = useState({ quote: null, error: '' })
  const [quoteRetry, setQuoteRetry] = useState(0)
  const draftScope = useMemo(() => ({ userId: currentUserId, groupId, expenseId, revision: expenseRevision }), [currentUserId, groupId, expenseId, expenseRevision])
  const [pendingPayload, setPendingPayload] = useState(() => initialValues ? null : readExpenseRequest(draftScope))
  const [recovered] = useState(() => readDraft(draftScope))
  const startingValues = requestToDraft(pendingPayload) || recovered || initialValues
  const [draftStatus, setDraftStatus] = useState(recovered ? 'Draft restored on this device.' : '')
  const savedRef = useRef(false)
  const [amount, setAmount] = useState(startingValues?.amount || '')
  const [description, setDescription] = useState(startingValues?.description || '')
  const [category, setCategory] = useState(startingValues?.category || 'food')
  const [paidBy, setPaidBy] = useState(startingValues?.paidBy || currentUserId)
  const [splitMembers, setSplitMembers] = useState(startingValues?.splitMembers || members.map((member) => member.id))
  const [splitType, setSplitType] = useState(startingValues?.splitType || 'equal')
  const [splitValues, setSplitValues] = useState(startingValues?.splitValues || {})
  const [currency, setCurrency] = useState(startingValues?.currency || baseCurrency)
  const [showCurrency, setShowCurrency] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showCustomSplit, setShowCustomSplit] = useState(Boolean(startingValues && startingValues.splitType !== 'equal'))
  const [attempted, setAttempted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [receiptData, setReceiptData] = useState(recovered?.receiptData || null)
  const [showAssigner, setShowAssigner] = useState(Boolean(recovered?.showAssigner))
  const [sharedItems, setSharedItems] = useState(recovered?.sharedItems || [])
  const [receiptReview, setReceiptReview] = useState(recovered?.receiptReview || null)
  const handleReceiptDraft = React.useCallback(value => setReceiptReview(value), [])
  const fileInputRef = useRef(null)
  const amountRef = useRef(null)
  const paidBySectionRef = useRef(null)
  const submitInFlightRef = useRef(false)
  const { scanReceipt, scanning, error: scanError, setError: setScanError, quota: scanQuota } = useReceiptScanner()

  useEffect(() => {
    if (!groupId || savedRef.current) return
    const baseline = initialValues || { amount: '', description: '', category: 'food', paidBy: currentUserId,
      currency: baseCurrency, splitType: 'equal', splitMembers: members.map(member => member.id), splitValues: {} }
    const dirty = String(amount) !== String(baseline.amount) || description !== baseline.description ||
      category !== baseline.category || paidBy !== baseline.paidBy || currency !== baseline.currency ||
      splitType !== baseline.splitType || splitMembers.join('|') !== baseline.splitMembers.join('|') ||
      sharedItems.length > 0 || Boolean(receiptData) ||
      (splitType !== 'equal' && splitMembers.some(id => Number(splitValues[id] || 0) !== Number(baseline.splitValues[id] || 0)))
    if (!dirty) { clearDraft(draftScope); setDraftStatus('Unfinished expenses stay on this device.'); return }
    // Persist extracted receipt fields, never the uploaded image.
    const saved = writeDraft(draftScope, { amount: String(amount), description, category, paidBy,
      splitMembers, splitType, splitValues, currency, sharedItems, receiptData, receiptReview, showAssigner })
    setDraftStatus(saved ? (recovered ? 'Draft restored and saved on this device.' : 'Draft saved on this device.') : 'Draft could not be saved on this device. Keep this form open.')
  }, [draftScope, groupId, amount, description, category, paidBy, splitMembers, splitType, splitValues, currency, sharedItems, receiptData, receiptReview, showAssigner, recovered, initialValues, currentUserId, baseCurrency, members])

  const discardDraft = () => {
    if (submitting || scanning || pendingPayload || !window.confirm('Discard this draft and start again?')) return
    clearDraft(draftScope)
    setAmount(initialValues?.amount || ''); setDescription(initialValues?.description || '')
    setCategory(initialValues?.category || 'food'); setPaidBy(initialValues?.paidBy || currentUserId)
    setSplitMembers(initialValues?.splitMembers || members.map(member => member.id))
    setSplitType(initialValues?.splitType || 'equal'); setSplitValues(initialValues?.splitValues || {})
    setCurrency(initialValues?.currency || baseCurrency); setSharedItems([]); setReceiptData(null)
    setReceiptReview(null); setShowAssigner(false); setShowCustomSplit(Boolean(initialValues && initialValues.splitType !== 'equal'))
    setAttempted(false); setSubmitError('')
  }

  const focusPaidBySelection = () => {
    window.setTimeout(() => {
      const target = paidBySectionRef.current?.querySelector(`[data-paid-by="${paidBy}"]`)
      if (target instanceof HTMLElement) target.focus()
    }, 120)
  }

  // Leave the keyboard closed until the user chooses a field.
  useEffect(() => {
    onDraftChange?.({
      dirty: initialValues ? (
        String(amount) !== String(initialValues.amount) || description !== initialValues.description ||
        category !== initialValues.category || paidBy !== initialValues.paidBy || currency !== initialValues.currency ||
        splitType !== initialValues.splitType || sharedItems.length > 0 || Boolean(receiptData) ||
        splitMembers.join('|') !== initialValues.splitMembers.join('|') ||
        (splitType !== 'equal' && splitMembers.some((id) => Number(splitValues[id] || 0) !== Number(initialValues.splitValues[id] || 0)))
      ) : Boolean(
        amount ||
        description ||
        sharedItems.length ||
        receiptData ||
        currency !== baseCurrency ||
        category !== 'food' ||
        splitType !== 'equal' ||
        paidBy !== currentUserId ||
        splitMembers.length !== members.length,
      ),
      busy: submitting || scanning,
    })
  }, [
    amount,
    description,
    sharedItems,
    receiptData,
    currency,
    baseCurrency,
    category,
    splitType,
    paidBy,
    currentUserId,
    splitMembers.length,
    members.length,
    submitting,
    scanning,
    onDraftChange,
    initialValues,
    splitValues,
  ])

  useEffect(() => {
    const allMemberIds = members.map((member) => member.id)
    // Realtime refreshes must not erase choices already made in this draft.
    setPaidBy((previous) => (allMemberIds.includes(previous) ? previous : currentUserId))
    setSplitMembers((previous) => previous.filter((id) => allMemberIds.includes(id)))
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
      })),
    )
  }, [currentUserId, members])

  const numericAmount = useMemo(() => Number(amount || 0), [amount])
  const allMemberIds = useMemo(() => members.map((member) => member.id), [members])

  const itemizedPreview = useMemo(() => {
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
  }, [allMemberIds, sharedItems])

  const selectedMembers = useMemo(
    () => members.filter((member) => splitMembers.includes(member.id)),
    [members, splitMembers],
  )
  const sharedItemMemberChoices = selectedMembers.length > 0 ? selectedMembers : members

  const perPersonAmount = useMemo(() => {
    if (!numericAmount || splitMembers.length === 0) return '0.00'
    return (numericAmount / splitMembers.length).toFixed(2)
  }, [numericAmount, splitMembers.length])

  const percentSum = useMemo(() => {
    if (splitType !== 'percent') return 0
    return round2(selectedMembers.reduce((sum, member) => sum + Number(splitValues[member.id] || 0), 0))
  }, [splitType, selectedMembers, splitValues])

  const combinedExactValues = useMemo(() => {
    const next = {}

    for (const member of selectedMembers) {
      next[member.id] = Number(splitValues[member.id] || 0)
    }

    for (const memberId of itemizedPreview.splitMembers) {
      next[memberId] = Number(next[memberId] || 0) + Number(itemizedPreview.splitValues[memberId] || 0)
    }

    return next
  }, [itemizedPreview.splitMembers, itemizedPreview.splitValues, selectedMembers, splitValues])

  const combinedExactSum = useMemo(
    () => round2(Object.values(combinedExactValues).reduce((sum, value) => sum + Number(value || 0), 0)),
    [combinedExactValues],
  )

  const splitValidationMessage = useMemo(() => {
    if (splitMembers.length === 0) return 'Choose at least one member'
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return 'Enter a valid amount'

    if (splitType === 'exact') {
      if (sharedItems.length > 0) {
        if (itemizedPreview.missingAmountItems > 0) return 'Enter an amount for each shared item'
        if (itemizedPreview.hasInvalidAmount) return 'Shared item amounts must be greater than 0'
        if (itemizedPreview.missingMemberItems > 0) return 'Choose at least one person for each shared item'
      }

      if (combinedExactSum !== round2(numericAmount)) {
        return combinedExactSum < numericAmount
          ? `Allocate ${formatMoney(round2(numericAmount - combinedExactSum), currency)} more`
          : `Reduce allocations by ${formatMoney(round2(combinedExactSum - numericAmount), currency)}`
      }
    }

    if (splitType === 'percent' && percentSum !== 100) {
      return 'Percentages must total 100%'
    }

    return null
  }, [
    combinedExactSum,
    currency,
    itemizedPreview.hasInvalidAmount,
    itemizedPreview.missingAmountItems,
    itemizedPreview.missingMemberItems,
    numericAmount,
    percentSum,
    sharedItems.length,
    splitMembers.length,
    splitType,
  ])

  const foreignCurrency = currency !== baseCurrency
  const quoteReady = !foreignCurrency || quoteMatches(conversion.quote, currency, baseCurrency)
  useEffect(() => {
    if (savedRef.current) return
    let active = true
    setConversion({ quote: pendingPayload?.reviewedQuote || null, error: '' })
    if (foreignCurrency && !pendingPayload) fetchExpenseQuote({ fromCurrency: currency, toCurrency: baseCurrency, savedExpense })
      .then(quote => { if (active) setConversion({ quote, error: '' }) })
      .catch(error => { if (active) setConversion({ quote: null, error: error.message || 'Unable to load conversion.' }) })
    // Ignore a late quote after currency changes or the form closes.
    return () => { active = false }
  }, [currency, baseCurrency, foreignCurrency, savedExpense, quoteRetry, pendingPayload])

  const canSubmit = !submitting && (Boolean(pendingPayload) || Boolean(amount && description.trim() && !splitValidationMessage && !submitting && quoteReady))

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
      const base = Math.floor(10000 / count) / 100
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
      }),
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

  const handleSubmit = async () => {
    setAttempted(true)
    setSubmitError('')
    if (!canSubmit) {
      document
        .getElementById(
          !Number.isFinite(numericAmount) || numericAmount <= 0
            ? 'expense-amount'
            : !description.trim()
              ? 'expense-description'
              : 'expense-feedback',
        )
        ?.focus()
      return
    }
    if (submitInFlightRef.current) return

    submitInFlightRef.current = true
    setSubmitting(true)
    try {
      const activeSplitMembers =
        splitType === 'exact'
          ? Object.keys(combinedExactValues).filter((userId) => Number(combinedExactValues[userId] || 0) > 0)
          : splitMembers

      const payloadSplitValues = activeSplitMembers.reduce((acc, userId) => {
        if (splitType === 'exact') {
          acc[userId] = Number(combinedExactValues[userId] || 0).toFixed(2)
        } else {
          acc[userId] = splitValues[userId] || '0'
        }
        return acc
      }, {})

      const request = pendingPayload || {
        amount: parseFloat(amount),
        description: description.trim(),
        category,
        paid_by: paidBy,
        split_members: activeSplitMembers,
        split_type: splitType,
        split_values: payloadSplitValues,
        currency,
        reviewedQuote: foreignCurrency ? conversion.quote : null,
        ...(!initialValues ? { requestId: crypto.randomUUID() } : {}),
      }
      if (!initialValues && !pendingPayload) {
        if (groupId && !rememberExpenseRequest(draftScope, request)) throw Object.assign(new Error('Unable to retain this save request on your device. Enable browser storage before saving.'), { definitelyRejected: true })
        setPendingPayload(request)
      }
      const saved = await onSubmit(request)
      if (saved !== false) {
        savedRef.current = true; clearDraft(draftScope); forgetExpenseRequest(draftScope); setPendingPayload(null)
      } else { forgetExpenseRequest(draftScope); setPendingPayload(null) }
    } catch (error) {
      if (error.definitelyRejected) { forgetExpenseRequest(draftScope); setPendingPayload(null) }
      setSubmitError(error.message || 'Unable to add expense. Please try again.')
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
    const scannedCurrency = String(data.currency || '')
      .trim()
      .toUpperCase()
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

    setReceiptReview(null)
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

    setSharedItems([])
    setSplitType('exact')

    setSplitMembers(nextSplits.map((item) => item.memberId))
    setSplitValues(
      nextSplits.reduce((acc, item) => {
        acc[item.memberId] = String(round2(item.amount))
        return acc
      }, {}),
    )

    setShowAssigner(false)
    setShowCustomSplit(true)
    focusPaidBySelection()
  }

  if (showAssigner && receiptData) {
    return (
      <div className="px-5 py-4">
        <ReceiptAssigner
          receipt={receiptData}
          initialDraft={receiptReview}
          onDraftChange={handleReceiptDraft}
          members={members}
          onConfirm={handleAssignConfirm}
          onCancel={() => {
            setShowAssigner(false)
            focusPaidBySelection()
          }}
        />
      </div>
    )
  }

  return (
    <form
      className="flex flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
    >
      {groupId && <div className="px-5 py-3 flex items-center justify-between gap-3 border-b border-gray-100">
        <p role="status" className="text-sm text-gray-600">{draftStatus}</p>
        <button type="button" disabled={submitting || scanning || Boolean(pendingPayload)} onClick={discardDraft} className="min-h-11 px-2 text-sm font-semibold text-sky-700">Discard draft</button>
      </div>}
      {pendingPayload && <p role="status" className="mx-5 my-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This save has not been confirmed. Retry the original expense to check its result safely. Its details stay locked until confirmed or rejected.</p>}
      <fieldset disabled={submitting || Boolean(pendingPayload)} className="min-w-0 border-0 p-0 m-0">
      <div className="bg-sky-50 border-b border-sky-100 px-5 py-6 text-center">
        <label htmlFor="expense-amount" className="block text-sm font-semibold text-gray-600 mb-2">
          Amount
        </label>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            aria-label={`Change currency, currently ${currency}`}
            aria-expanded={showCurrency}
            onClick={() => setShowCurrency((value) => !value)}
            className="text-sky-600 font-bold text-2xl"
          >
            {currency}
          </button>
          <input
            ref={amountRef}
            id="expense-amount"
            required
            aria-invalid={attempted && (!Number.isFinite(numericAmount) || numericAmount <= 0)}
            aria-describedby="expense-feedback"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              const nextValue = sanitizeDecimalInput(event.target.value)
              if (nextValue !== null) setAmount(nextValue)
            }}
            placeholder="0.00"
            className="bg-transparent text-5xl font-black text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-sky-700 rounded-lg w-44 placeholder-gray-300"
          />
        </div>
        {amount && splitMembers.length > 1 && splitType === 'equal' && (
          <p className="text-sky-600 text-sm font-medium mt-1">
            {formatMoney(perPersonAmount, currency)} each &middot; {splitMembers.length} people
          </p>
        )}

        {showCurrency && (
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            {CURRENCIES.map((item) => (
              <button
                type="button"
                key={item.code}
                onClick={() => {
                  setCurrency(item.code)
                  setShowCurrency(false)
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${
                  currency === item.code
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                {item.code}
              </button>
            ))}
          </div>
        )}
      </div>

      {foreignCurrency && <section aria-label="Currency conversion" className="mx-5 mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-gray-700">
        <p className="font-semibold">Converted to group currency</p>
        {!quoteReady ? <div role={conversion.error ? 'alert' : 'status'}>
          <p>{conversion.error || 'Loading conversion...'}</p>
          {conversion.error && <button type="button" className="min-h-11 font-semibold text-sky-700" onClick={() => setQuoteRetry(value => value + 1)}>Retry conversion</button>}
        </div> : <div className="space-y-1" role="status">
          <p className="font-bold text-base break-words">{formatMoney(numericAmount, currency)} → {formatMoney(convertedExpenseAmount(round2(numericAmount), currency, conversion.quote.rate, savedExpense), baseCurrency)}</p>
          <p>1 {currency} = {conversion.quote.rate} {baseCurrency}</p>
          <p className="break-words">Source: {conversion.quote.source.replaceAll('_', ' ')} · Quote date: {conversion.quote.asOfDate || 'unavailable'}</p>
          {conversion.quote.saved && <p>This correction keeps the saved exchange rate.</p>}
          {quoteNeedsNotice(conversion.quote) && <p className="text-amber-800">This is an older or stored quote. Review the conversion before saving.</p>}
          {conversion.quote.source === 'open_er_api' && <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sky-700 underline">Rates By Exchange Rate API</a>}
          <p>This rate will be used when saving. Bank or card charges may differ.</p>
        </div>}
      </section>}
      <div className="px-5 py-4 space-y-5">
        <div>
          <label htmlFor="expense-description" className="block text-sm font-semibold text-gray-700 mb-2">
            What was this for?
          </label>
          <input
            id="expense-description"
            required
            aria-invalid={attempted && !description.trim()}
            aria-describedby={attempted && !description.trim() ? 'expense-feedback' : undefined}
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What was this for?"
            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
          />
        </div>
        <details className="rounded-2xl border border-gray-200 p-3">
          <summary className="text-sm font-semibold text-sky-700 cursor-pointer min-h-11 flex items-center">
            Split an itemized receipt (optional)
          </summary>{' '}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Useful when people ordered different items. For an equal split, entering the total is usually quicker. You can review and correct the scan before saving.</p>
            <button
              type="button"

              onClick={() => {
                setScanError(null)
                fileInputRef.current?.click()
              }}
              disabled={scanning}
              className="w-full py-3 rounded-2xl border border-sky-200 bg-sky-50 text-sky-700 font-semibold text-sm disabled:opacity-60"
            >
              {scanning ? 'Scanning receipt...' : <>&#128247; Scan receipt</>}
            </button>
            <p className="text-xs text-gray-500">
              {scanQuota && Date.parse(scanQuota.resetsAt) > Date.now()
                ? `${scanQuota.remaining} of 5 scans remaining today.`
                : 'Up to 5 receipt scans per account each day.'}{' '}
              Resets at midnight Singapore time. Unreadable receipts use an attempt. Service failures do not use your scan allowance. Repeated requests have a separate daily safety limit.
            </p>
            <p className="text-xs text-gray-500">Your receipt image is sent to Google for processing. Cover personal details before uploading. JPEG, PNG or WebP, up to 3 MB.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleReceiptUpload}
              className="hidden"
            />
            {scanError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold text-amber-800">{scanError}</p>
                <p className="text-xs text-amber-700 mt-0.5">You can still enter the expense manually.</p>
              </div>
            )}
          </div>
        </details>{' '}
        <div ref={paidBySectionRef}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Paid by</p>
          <div className="flex gap-2 flex-wrap">
            {members.map((member) => (
              <button
                type="button"
                key={member.id}

                data-paid-by={member.id}
                aria-pressed={paidBy === member.id}
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
                  type="button"
                  key={member.id}
                  aria-pressed={included}
                  onClick={() => toggleMember(member.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-2xl border-2 transition-all ${
                    included ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <Avatar user={member} size="xs" />
                  <span className={`text-sm font-semibold ${included ? 'text-sky-700' : 'text-gray-500'}`}>
                    {member.id === currentUserId ? 'You' : member.display_name}
                  </span>
                  {included && <span className="text-sky-500 text-xs">&#10003;</span>}
                </button>
              )
            })}
          </div>
        </div>
        <div className="rounded-2xl bg-sky-50 border border-sky-100 p-4">
          <p className="font-semibold text-gray-900">
            {splitType === 'equal' ? 'Split equally' : splitType === 'exact' ? 'Exact amounts' : 'Percentage split'}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {splitType === 'equal'
              ? `${formatMoney(perPersonAmount, currency)} each · ${splitMembers.length} people`
              : `${splitMembers.length} people · custom allocations`}
          </p>
          <button
            type="button"
            className="min-h-11 text-sm font-semibold text-sky-700"
            aria-expanded={showCustomSplit}
            aria-controls="custom-split"
            onClick={() => setShowCustomSplit((value) => !value)}
          >
            {showCustomSplit ? 'Hide split options' : 'Customize split'}
          </button>
        </div>
        <div id="custom-split" hidden={!showCustomSplit} className="space-y-5">
          {' '}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Split type</p>
            <div className="flex bg-gray-100 rounded-2xl p-1">
              {SPLIT_TYPES.map((type) => (
                <button
                  type="button"
                  key={type.id}
                  aria-pressed={splitType === type.id}
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
                    ? `${formatMoney(combinedExactSum, currency)} / ${formatMoney(numericAmount || 0, currency)}`
                    : `${percentSum.toFixed(2)}% / 100%`}
                </p>
              </div>

              <div className="space-y-2">
                {selectedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5"
                  >
                    <Avatar user={member} size="xs" />
                    <span className="text-sm font-semibold text-gray-700 flex-1 min-w-0 truncate">
                      {member.id === currentUserId ? 'You' : member.display_name}
                    </span>
                    <div className="flex items-center gap-1">
                      {splitType === 'exact' && <span className="text-xs text-gray-400">{currency}</span>}
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`${member.display_name}, ${splitType === 'exact' ? 'amount' : 'percentage'}`}
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
          {splitType === 'exact' && (
            <>
              {' '}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Shared items (optional)</p>
                  <button
                    type="button"
                    onClick={addSharedItemRow}
                    disabled={splitType !== 'exact'}
                    className="px-3 py-1.5 rounded-full bg-white border border-sky-200 text-sky-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    + Add shared item
                  </button>
                </div>
                {splitType !== 'exact' && (
                  <p className="text-xs text-gray-500">Shared items work with Exact split only.</p>
                )}

                {splitType === 'exact' && sharedItems.length > 0 && (
                  <div className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/40 p-3">
                    <div className="space-y-2">
                      {sharedItems.map((item, index) => (
                        <div key={item.id} className="rounded-2xl bg-white border border-sky-100 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              aria-label={`Shared item ${index + 1} name`}
                              value={item.name}
                              onChange={(event) => handleSharedItemChange(item.id, 'name', event.target.value)}
                              placeholder={`Item ${index + 1} (e.g. Fries)`}
                              className="flex-1 min-w-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
                            />
                            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-xl">
                              <span className="text-xs text-gray-500 font-semibold">{currency}</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                aria-label={`Shared item ${index + 1} amount`}
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
                              &times;
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {sharedItemMemberChoices.map((member) => {
                              const selected = (item.memberIds || []).includes(member.id)
                              return (
                                <button
                                  type="button"
                                  key={`${item.id}-${member.id}`}

                                  aria-pressed={selected}
                                  onClick={() => toggleSharedItemMember(item.id, member.id)}
                                  className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                                    selected
                                      ? 'border-sky-400 bg-sky-50 text-sky-700'
                                      : 'border-gray-200 bg-white text-gray-600'
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

                    <div className="rounded-2xl border border-sky-100 bg-white p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                        <span>Shared items total</span>
                        <span>{formatMoney(itemizedPreview.total, currency)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                        <span>Exact + shared total</span>
                        <span>{formatMoney(combinedExactSum, currency)}</span>
                      </div>
                      {Object.keys(combinedExactValues)
                        .filter((memberId) => Number(combinedExactValues[memberId] || 0) > 0)
                        .map((memberId) => {
                          const member = members.find((entry) => entry.id === memberId)
                          if (!member) return null
                          return (
                            <div
                              key={`combined-preview-${memberId}`}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-700">
                                {member.id === currentUserId ? 'You' : member.display_name}
                              </span>
                              <span className="font-semibold text-sky-700">
                                {formatMoney(Number(combinedExactValues[memberId] || 0), currency)}
                              </span>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <details>
          <summary className="text-sm font-semibold text-gray-700 cursor-pointer min-h-11 flex items-center">
            Category (optional)
          </summary>{' '}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Category</p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={category === item.id}
                  onClick={() => setCategory(item.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-2xl border-2 transition-all ${
                    category === item.id ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className={`text-xs font-semibold ${category === item.id ? 'text-sky-700' : 'text-gray-500'}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </details>
      </div>
      </fieldset>
      {/* Sticky within the sheet so the action follows the visible viewport. */}
      <footer className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 safe-bottom">
        <p
          id="expense-feedback"
          tabIndex={-1}
          role={submitError || (attempted && !canSubmit) ? 'alert' : undefined}
          className="text-sm text-gray-600 mb-2"
        >
          {submitError
            ? `${submitError} Your entries are kept. Try again.`
            : attempted && !canSubmit
              ? (!quoteReady ? conversion.error || 'Wait for the currency conversion before saving.' : splitValidationMessage || 'Enter a description for this expense')
              : canSubmit
                ? initialValues ? 'Ready to save. Balances will update and the correction will be logged.' : 'Ready to add. Everyone’s balance will update.'
                : 'Enter an amount and description to continue.'}
        </p>
        <button
          type="submit"
          disabled={submitting || scanning}
          className="w-full py-4 bg-sky-500 text-white rounded-2xl font-bold text-base disabled:opacity-50"
        >
          {submitting
            ? initialValues ? 'Saving correction...' : 'Adding expense...'
            : pendingPayload ? 'Retry original expense' : `${initialValues ? 'Save correction' : 'Add expense'} ${amount ? `· ${formatMoney(numericAmount, currency)}` : ''}`}
        </button>
      </footer>
    </form>
  )
}
