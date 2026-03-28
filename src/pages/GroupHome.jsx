import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  GROUPS, EXPENSES, USERS, CURRENT_USER, SMART_BALANCES,
  formatMoney, timeAgo, getCategoryIcon
} from '../data/mockData'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import BottomSheet from '../components/BottomSheet'
import QuickSplit from './QuickSplit'

// ─── Inline toast (self-contained so it works without context) ──────────────
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
      <span className="text-emerald-400 text-base">✓</span>
      <span className="text-sm font-semibold">{message}</span>
    </div>
  )
}

// ─── Nudge bottom sheet ──────────────────────────────────────────────────────
const NUDGE_PRESETS = [
  { emoji: '🍩', text: 'Time to pay up! 🍩' },
  { emoji: '🥺', text: 'My wallet is lonely 🥺' },
  { emoji: '🦖', text: 'Debt collectors are coming! 🦖' },
]

function NudgeSheet({ isOpen, onClose, targetUser, amount }) {
  const [selected, setSelected] = useState(null)
  const [custom, setCustom] = useState('')
  const [sent, setSent] = useState(false)

  const handleSend = () => {
    setSent(true)
    setTimeout(() => {
      setSent(false)
      setSelected(null)
      setCustom('')
      onClose()
    }, 1400)
  }

  const message = custom.trim() || (selected !== null ? NUDGE_PRESETS[selected].text : '')

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Send a Nudge">
      <div className="px-5 py-4 space-y-4 pb-8">
        {/* Who you're nudging */}
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-3.5">
          <Avatar user={targetUser} size="md" />
          <div>
            <p className="font-bold text-gray-900 text-sm">{targetUser?.display_name}</p>
            <p className="text-amber-600 text-xs font-medium">owes you {amount}</p>
          </div>
        </div>

        {/* Preset messages */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">Quick messages</p>
          <div className="space-y-2">
            {NUDGE_PRESETS.map((preset, i) => (
              <button
                key={i}
                onClick={() => { setSelected(i); setCustom('') }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all ${
                  selected === i
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                <span className="text-xl">{preset.emoji}</span>
                <span className="font-semibold text-sm flex-1">{preset.text}</span>
                {selected === i && (
                  <span className="text-amber-500 font-bold text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Custom message */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Custom message</p>
          <textarea
            value={custom}
            onChange={e => { setCustom(e.target.value); setSelected(null) }}
            placeholder="Write your own nudge..."
            rows={3}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
          />
        </div>

        {/* Send button */}
        {sent ? (
          <div className="w-full py-4 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center gap-2">
            <span className="text-emerald-600 font-bold text-sm">Nudge sent! 🎉</span>
          </div>
        ) : (
          <button
            onClick={handleSend}
            disabled={!message}
            className="w-full py-4 bg-amber-400 text-white rounded-full font-bold text-sm disabled:opacity-40 transition-opacity"
            style={message ? { boxShadow: '0 4px 16px rgba(251, 191, 36, 0.4)' } : {}}
          >
            Send nudge 👋
          </button>
        )}
      </div>
    </BottomSheet>
  )
}

// ─── Expense row ─────────────────────────────────────────────────────────────
function ExpenseRow({ expense, onReact }) {
  const paidBy = USERS[expense.paid_by]

  const totalReactions = Object.entries(expense.reactions || {}).map(([emoji, users]) => ({
    emoji, count: users.length, reacted: users.includes(CURRENT_USER.id)
  })).filter(r => r.count > 0)

  return (
    <div className="flex gap-3 py-3.5 border-b border-gray-50 last:border-0">
      <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl">
        {getCategoryIcon(expense.category)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{expense.description}</p>
            <p className="text-gray-400 text-xs mt-0.5">
              {paidBy?.id === CURRENT_USER.id ? 'You' : paidBy?.display_name} paid · {timeAgo(expense.created_at)}
            </p>
          </div>
          <div className="flex-shrink-0 ml-2 text-right">
            <p className="font-bold text-gray-900 text-sm">{formatMoney(expense.amount)}</p>
            {expense.original_currency && (
              <p className="text-gray-400 text-xs">
                {expense.original_currency} {Math.round(expense.original_amount).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          {['👍', '😂', '😳'].map(emoji => {
            const r = totalReactions.find(r => r.emoji === emoji)
            return (
              <button
                key={emoji}
                onClick={() => onReact(expense.id, emoji)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                  r?.reacted
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : r
                    ? 'bg-gray-100 text-gray-600'
                    : 'text-gray-300 hover:text-gray-400'
                }`}
              >
                <span>{emoji}</span>
                {r && <span className="font-semibold">{r.count}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── SmartBalance card ───────────────────────────────────────────────────────
function SmartBalanceCard({ balance, currentUserId, onPay, onNudge }) {
  const fromUser = USERS[balance.from]
  const toUser = USERS[balance.to]
  const iOwe = balance.from === currentUserId
  const owedToMe = balance.to === currentUserId

  if (!iOwe && !owedToMe) return null

  return (
    <div className={`flex items-center justify-between p-4 rounded-2xl border ${
      iOwe ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
    }`}>
      <div className="flex items-center gap-3">
        <Avatar user={iOwe ? toUser : fromUser} size="md" />
        <div>
          <p className="font-bold text-gray-900 text-sm">
            {iOwe
              ? `You owe ${toUser?.display_name}`
              : `${fromUser?.display_name} owes you`}
          </p>
          <p className={`font-black text-lg ${iOwe ? 'text-red-500' : 'text-emerald-600'}`}>
            {formatMoney(balance.amount)}
          </p>
        </div>
      </div>

      {iOwe ? (
        <button
          onClick={() => onPay(balance)}
          className="px-4 py-2 rounded-full bg-emerald-500 text-white font-bold text-sm active:scale-95 transition-transform"
          style={{ boxShadow: '0 2px 10px rgba(16,185,129,0.35)' }}
        >
          Pay
        </button>
      ) : (
        <button
          onClick={() => onNudge(balance)}
          className="px-4 py-2 rounded-full bg-amber-400 text-white font-bold text-sm active:scale-95 transition-transform"
          style={{ boxShadow: '0 2px 10px rgba(251,191,36,0.35)' }}
        >
          Nudge
        </button>
      )}
    </div>
  )
}

// ─── Main GroupHome ──────────────────────────────────────────────────────────
export default function GroupHome() {
  const { id } = useParams()
  const navigate = useNavigate()
  const group = GROUPS.find(g => g.id === id)
  const [expenses, setExpenses] = useState(EXPENSES[id] || [])
  const [showQuickSplit, setShowQuickSplit] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showNotes, setShowNotes] = useState(true)
  const [nudgeTarget, setNudgeTarget] = useState(null) // { balance }
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)

  const balances = (SMART_BALANCES[id] || []).map(b => ({ ...b, group_id: id }))

  if (!group) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-400">Group not found</p>
    </div>
  )

  const members = group.member_ids.map(uid => USERS[uid]).filter(Boolean)
  const myBalances = balances.filter(b => b.from === CURRENT_USER.id || b.to === CURRENT_USER.id)
  const allSettled = myBalances.length === 0

  // ── Toast helper ──
  const showToast = (msg) => {
    setToastMsg(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 3000)
  }

  // ── Pay handler: copy PayNow + open PayLah deep link ──
  const handlePay = (balance) => {
    const toUser = USERS[balance.to]
    const payNowNumber = toUser?.paynow_number

    if (payNowNumber) {
      navigator.clipboard?.writeText(payNowNumber).catch(() => {})
    }

    // Navigate to Pay screen which has QR + mark as paid
    navigate(
      `/groups/${id}/settle?from=${balance.from}&to=${balance.to}&amount=${balance.amount}`
    )

    // Trigger PayLah deep link + show toast
    window.location.href = 'dbspaylah://'
    showToast('PayNow number copied! Opening PayLah…')
  }

  // ── Nudge handler ──
  const handleNudge = (balance) => {
    setNudgeTarget(balance)
  }

  const handleReact = (expenseId, emoji) => {
    setExpenses(prev => prev.map(exp => {
      if (exp.id !== expenseId) return exp
      const reactions = { ...exp.reactions }
      const users = reactions[emoji] || []
      if (users.includes(CURRENT_USER.id)) {
        reactions[emoji] = users.filter(u => u !== CURRENT_USER.id)
      } else {
        Object.keys(reactions).forEach(e => {
          if (e !== emoji) reactions[e] = (reactions[e] || []).filter(u => u !== CURRENT_USER.id)
        })
        reactions[emoji] = [...users, CURRENT_USER.id]
      }
      return { ...exp, reactions }
    }))
  }

  const handleAddExpense = (data) => {
    const newExpense = {
      id: `exp-${Date.now()}`,
      group_id: id,
      ...data,
      created_at: new Date().toISOString(),
      created_by: CURRENT_USER.id,
      reactions: {},
      original_amount: null,
      original_currency: null,
      exchange_rate: null,
      splits: data.split_members.map(userId => ({
        user_id: userId,
        amount: (data.amount / data.split_members.length).toFixed(2),
        is_settled: false,
      })),
    }
    setExpenses(prev => [newExpense, ...prev])
    setShowQuickSplit(false)
    showToast('Expense added!')
  }

  // Nudge banner: debt owed to me
  const nudgeBanner = balances.find(b => b.to === CURRENT_USER.id)
  // Nudge sheet target user
  const nudgeUser = nudgeTarget ? USERS[nudgeTarget.from] : null

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Floating toast */}
      <InlineToast message={toastMsg} visible={toastVisible} />

      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/dashboard')} className="text-gray-500 -ml-1">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-gray-900 truncate">{group.name}</h1>
            <p className="text-gray-400 text-xs">{members.length} members · {formatMoney(group.total_spent)} total</p>
          </div>
          <button onClick={() => setShowMenu(true)} className="text-gray-400 p-1">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M12 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z"/>
            </svg>
          </button>
        </div>

        {/* Member avatars */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {members.map(user => (
            <div key={user.id} className="flex flex-col items-center gap-1">
              <Avatar user={user} size="sm" ring={user.id === CURRENT_USER.id} />
              <span className="text-[10px] text-gray-400 font-medium">
                {user.id === CURRENT_USER.id ? 'You' : user.display_name.split(' ')[0]}
              </span>
            </div>
          ))}
          <button
            onClick={() => navigator.clipboard?.writeText(`fairsplit.app/join/${group.invite_code}`)}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center ml-1 flex-shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Group notes banner */}
        {group.notes && showNotes && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex gap-2.5">
            <span className="text-base flex-shrink-0 mt-0.5">📌</span>
            <div className="flex-1 min-w-0">
              <p className="text-amber-800 text-xs font-semibold mb-0.5">Group notes</p>
              <p className="text-amber-700 text-sm leading-relaxed line-clamp-2">{group.notes}</p>
            </div>
            <button onClick={() => setShowNotes(false)} className="text-amber-400 flex-shrink-0 text-xs">✕</button>
          </div>
        )}

        {/* Nudge banner (debt owed to me > 7 days) */}
        {nudgeBanner && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center gap-2.5">
            <span className="text-base">⏰</span>
            <div className="flex-1 min-w-0">
              <p className="text-amber-800 text-xs font-medium">
                {USERS[nudgeBanner.from]?.display_name} still owes you {formatMoney(nudgeBanner.amount)} — 7 days ago
              </p>
            </div>
            <button
              onClick={() => handleNudge(nudgeBanner)}
              className="text-amber-700 font-bold text-xs bg-amber-100 px-2.5 py-1.5 rounded-full flex-shrink-0"
            >
              Nudge
            </button>
          </div>
        )}

        {/* Smart Balances */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">Your balances</p>
          {allSettled ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
              <p className="text-2xl mb-1">✅</p>
              <p className="text-emerald-700 font-bold text-sm">All settled up!</p>
              <p className="text-emerald-500 text-xs mt-0.5">Everyone's even on this trip</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myBalances.map((b, i) => (
                <SmartBalanceCard
                  key={i}
                  balance={b}
                  currentUserId={CURRENT_USER.id}
                  onPay={handlePay}
                  onNudge={handleNudge}
                />
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Activity</p>
            <span className="text-xs text-gray-400">{expenses.length} expenses</span>
          </div>

          {expenses.length === 0 ? (
            <div className="text-center py-10 px-4 bg-white rounded-2xl border border-gray-100">
              <p className="text-4xl mb-3">🧾</p>
              <p className="font-bold text-gray-900 mb-1">No expenses yet</p>
              <p className="text-gray-500 text-sm">Tap + to add the first one</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 px-4">
              {expenses.map(exp => (
                <ExpenseRow key={exp.id} expense={exp} onReact={handleReact} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Nav */}
      <BottomNav onFABPress={() => setShowQuickSplit(true)} groupId={id} />

      {/* QuickSplit Sheet */}
      <BottomSheet isOpen={showQuickSplit} onClose={() => setShowQuickSplit(false)} title="Add Expense">
        <QuickSplit
          groupId={id}
          members={members}
          onSubmit={handleAddExpense}
          onClose={() => setShowQuickSplit(false)}
        />
      </BottomSheet>

      {/* Nudge Sheet */}
      <NudgeSheet
        isOpen={!!nudgeTarget}
        onClose={() => setNudgeTarget(null)}
        targetUser={nudgeUser}
        amount={nudgeTarget ? formatMoney(nudgeTarget.amount) : ''}
      />

      {/* Group menu */}
      <BottomSheet isOpen={showMenu} onClose={() => setShowMenu(false)}>
        <div className="px-5 py-5 space-y-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-2 mb-3">{group.name}</p>
          {[
            { icon: '🔗', label: 'Share invite link', action: () => setShowMenu(false) },
            { icon: '📝', label: 'Group notes', action: () => setShowMenu(false) },
            { icon: '📊', label: 'Spend insights', action: () => { setShowMenu(false); navigate(`/groups/${id}/insights`) } },
            { icon: '🏆', label: 'Trip summary', action: () => { setShowMenu(false); navigate(`/groups/${id}/summary`) } },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-gray-50 text-left"
            >
              <span className="text-xl w-8 text-center">{item.icon}</span>
              <span className="font-semibold text-gray-800 text-sm">{item.label}</span>
            </button>
          ))}
          <div className="border-t border-gray-100 mt-2 pt-2">
            <button className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl text-left">
              <span className="text-xl w-8 text-center">🗑️</span>
              <span className="font-semibold text-red-500 text-sm">Delete group</span>
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
