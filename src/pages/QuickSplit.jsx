import React, { useEffect, useMemo, useRef, useState } from 'react'
import Avatar from '../components/Avatar'
import { CATEGORIES, CURRENCIES, formatMoney } from '../lib/format'

const SPLIT_TYPES = [
  { id: 'equal', label: 'Equal' },
  { id: 'exact', label: 'Exact' },
  { id: 'percent', label: '%' },
]

export default function QuickSplit({ members, currentUserId, onSubmit }) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('food')
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [splitMembers, setSplitMembers] = useState(members.map((member) => member.id))
  const [splitType, setSplitType] = useState('equal')
  const [currency, setCurrency] = useState('SGD')
  const [showCurrency, setShowCurrency] = useState(false)
  const amountRef = useRef(null)

  useEffect(() => {
    window.setTimeout(() => amountRef.current?.focus(), 100)
  }, [])

  useEffect(() => {
    setPaidBy(currentUserId)
    setSplitMembers(members.map((member) => member.id))
  }, [currentUserId, members])

  const toggleMember = (userId) => {
    setSplitMembers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  const perPersonAmount = useMemo(() => {
    if (!amount || splitMembers.length === 0) return '0.00'
    return (parseFloat(amount) / splitMembers.length).toFixed(2)
  }, [amount, splitMembers.length])

  const handleSubmit = () => {
    if (!amount || !description || splitMembers.length === 0) return

    onSubmit({
      amount: parseFloat(amount),
      description,
      category,
      paid_by: paidBy,
      split_members: splitMembers,
      split_type: splitType,
      currency,
    })
  }

  return (
    <div className="flex flex-col">
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 px-5 py-6 text-center">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Amount</p>
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setShowCurrency((value) => !value)} className="text-emerald-600 font-bold text-2xl">
            {currency}
          </button>
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              const value = event.target.value.replace(/[^0-9.]/g, '')
              if ((value.match(/\./g) || []).length <= 1) setAmount(value)
            }}
            placeholder="0.00"
            className="bg-transparent text-5xl font-black text-gray-900 text-center focus:outline-none w-44 placeholder-gray-300"
          />
        </div>
        {amount && splitMembers.length > 1 && splitType === 'equal' && (
          <p className="text-emerald-600 text-sm font-medium mt-1">
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
                  currency === item.code ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                {item.code}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-4 space-y-5 pb-36">
        <div>
          <input
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What was this for?"
            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
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
                  category === item.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className={`text-[10px] font-semibold ${category === item.id ? 'text-emerald-700' : 'text-gray-500'}`}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Paid by</p>
          <div className="flex gap-2 flex-wrap">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => setPaidBy(member.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-2xl border-2 transition-all ${
                  paidBy === member.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'
                }`}
              >
                <Avatar user={member} size="xs" ring={paidBy === member.id} />
                <span className={`text-sm font-semibold ${paidBy === member.id ? 'text-emerald-700' : 'text-gray-600'}`}>
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
                    included ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white opacity-50'
                  }`}
                >
                  <Avatar user={member} size="xs" />
                  <span className={`text-sm font-semibold ${included ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {member.id === currentUserId ? 'You' : member.display_name}
                  </span>
                  {included && <span className="text-emerald-500 text-xs">✓</span>}
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
                onClick={() => setSplitType(type.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  splitType === type.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 py-4 bg-white border-t border-gray-100 z-50"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={handleSubmit}
          disabled={!amount || !description || splitMembers.length === 0}
          className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-base disabled:opacity-40 transition-opacity"
          style={{ boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)' }}
        >
          Add expense {amount ? `· ${formatMoney(parseFloat(amount) || 0, currency)}` : ''}
        </button>
      </div>
    </div>
  )
}
