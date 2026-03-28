import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  GROUPS,
  EXPENSES,
  USERS,
  CURRENT_USER,
  SMART_BALANCES,
  formatMoney,
  timeAgo,
  getCategoryIcon,
} from '../data/mockData'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import BottomSheet from '../components/BottomSheet'
import QuickSplit from './QuickSplit'

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

function ExpenseRow({ expense }) {
  const paidBy = USERS[expense.paid_by]

  return (
    <div className="flex gap-3 py-3.5 border-b border-gray-50 last:border-0">
      <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl">
        {getCategoryIcon(expense.category)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{expense.description}</p>
            <p className="text-gray-400 text-xs mt-0.5 truncate">
              paid by {paidBy?.id === CURRENT_USER.id ? 'You' : paidBy?.display_name}
            </p>
          </div>
          <p className="font-bold text-gray-900 text-sm text-right flex-shrink-0">{formatMoney(expense.amount)}</p>
        </div>
        <p className="text-gray-400 text-xs mt-1">{timeAgo(expense.created_at)}</p>
      </div>
    </div>
  )
}

function SmartBalanceCard({ balance, currentUserId, onPay, onRemind }) {
  const fromUser = USERS[balance.from]
  const toUser = USERS[balance.to]
  const iOwe = balance.from === currentUserId
  const owedToMe = balance.to === currentUserId

  if (!iOwe && !owedToMe) return null

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-2xl border ${
        iOwe ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar user={iOwe ? toUser : fromUser} size="md" />
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">
            {iOwe ? `You owe ${toUser?.display_name}` : `${fromUser?.display_name} owes you ${formatMoney(balance.amount)}`}
          </p>
          {iOwe && <p className="font-black text-lg text-red-500">{formatMoney(balance.amount)}</p>}
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
          onClick={() => onRemind(balance)}
          className="px-4 py-2 rounded-full bg-emerald-500 text-white font-bold text-sm active:scale-95 transition-transform"
          style={{ boxShadow: '0 2px 10px rgba(16,185,129,0.35)' }}
        >
          Remind
        </button>
      )}
    </div>
  )
}

function ConnectTelegramSheet({
  isOpen,
  onClose,
  groupName,
  isConnected,
  telegramGroupName,
  isConnecting,
  code,
  onCopy,
  copied,
  onDisconnect,
}) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Connect Telegram">
      <div className="px-5 py-4 pb-8">
        {isConnected ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Get expense updates and debt reminders in your group chat.
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <p className="text-emerald-800 font-semibold text-sm">✅ Connected to {telegramGroupName}</p>
              <p className="text-emerald-700 text-xs mt-1">Notifications are active for {groupName}.</p>
            </div>
            <button
              onClick={onDisconnect}
              className="w-full py-3.5 rounded-full border border-gray-200 text-gray-700 font-semibold text-sm"
            >
              Disconnect Telegram
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Get expense updates and debt reminders in your group chat.
            </p>

            <div className="space-y-3 text-sm text-gray-700">
              <p>
                <span className="font-semibold">1.</span> Add <span className="font-semibold">@FairSplitBot</span> to your Telegram group
              </p>
              <div>
                <p className="mb-2">
                  <span className="font-semibold">2.</span> Send this code in the chat:
                </p>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-5 text-center">
                  <span className="font-mono font-black text-3xl tracking-[0.3em] text-emerald-700">{code}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onCopy}
              className="px-4 py-2.5 rounded-full bg-emerald-500 text-white font-bold text-sm active:scale-95 transition-transform"
            >
              {copied ? 'Copied!' : 'Copy code'}
            </button>

            <div className="text-sm text-gray-500 flex items-center gap-2">
              <span>Waiting for connection...</span>
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </div>

            {isConnecting && (
              <p className="text-xs text-gray-400">Listening for @FairSplitBot confirmation...</p>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

export default function GroupHome() {
  const { id } = useParams()
  const navigate = useNavigate()
  const group = GROUPS.find(g => g.id === id)

  const [expenses, setExpenses] = useState(EXPENSES[id] || [])
  const [showQuickSplit, setShowQuickSplit] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showTelegramSheet, setShowTelegramSheet] = useState(false)
  const [showReminderBanner, setShowReminderBanner] = useState(true)
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)

  const [telegramConnected, setTelegramConnected] = useState(Boolean(group?.telegramConnected))
  const [telegramGroupName, setTelegramGroupName] = useState(group?.telegramGroupName || null)
  const [isTelegramConnecting, setIsTelegramConnecting] = useState(false)
  const [telegramCodeCopied, setTelegramCodeCopied] = useState(false)

  const telegramCode = (group?.invite_code || 'BALI42').slice(0, 6).toUpperCase()

  const balances = (SMART_BALANCES[id] || []).map(b => ({ ...b, group_id: id }))

  useEffect(() => {
    if (!showTelegramSheet || telegramConnected || !group) return

    setIsTelegramConnecting(true)
    const timer = window.setTimeout(() => {
      setTelegramConnected(true)
      setTelegramGroupName('Bali Crew 🌴')
      setIsTelegramConnecting(false)
    }, 3000)

    return () => window.clearTimeout(timer)
  }, [showTelegramSheet, telegramConnected, group])

  if (!group) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-400">Group not found</p>
      </div>
    )
  }

  const members = group.member_ids.map(uid => USERS[uid]).filter(Boolean)
  const myBalances = balances.filter(b => b.from === CURRENT_USER.id || b.to === CURRENT_USER.id)
  const allSettled = myBalances.length === 0

  const debtReminder = balances.find(b => b.from === CURRENT_USER.id)

  const showToast = msg => {
    setToastMsg(msg)
    setToastVisible(true)
    window.setTimeout(() => setToastVisible(false), 2200)
  }

  const handlePay = balance => {
    navigate(`/groups/${id}/pay?from=${balance.from}&to=${balance.to}&amount=${balance.amount}`)
  }

  const handleRemind = balance => {
    const debtor = USERS[balance.from]
    showToast(`Reminder sent to ${debtor?.display_name || 'member'}`)
  }

  const handleAddExpense = data => {
    const newExpense = {
      id: `exp-${Date.now()}`,
      group_id: id,
      ...data,
      created_at: new Date().toISOString(),
      created_by: CURRENT_USER.id,
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

  const handleShareInvite = async () => {
    try {
      await navigator.clipboard.writeText(`fairsplit.app/join/${group.invite_code}`)
      showToast('Invite link copied!')
    } catch {
      showToast('Unable to copy link')
    }
  }

  const handleCopyTelegramCode = async () => {
    try {
      await navigator.clipboard.writeText(telegramCode)
      setTelegramCodeCopied(true)
      window.setTimeout(() => setTelegramCodeCopied(false), 1400)
    } catch {
      setTelegramCodeCopied(false)
    }
  }

  const handleDisconnectTelegram = () => {
    setTelegramConnected(false)
    setTelegramGroupName(null)
    setIsTelegramConnecting(false)
    setTelegramCodeCopied(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <InlineToast message={toastMsg} visible={toastVisible} />

      <div className="bg-white px-5 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/dashboard')} className="text-gray-500 -ml-1">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-gray-900 truncate">{group.name}</h1>
            <p className="text-gray-400 text-xs">
              {members.length} members · {formatMoney(group.total_spent)} total
            </p>
          </div>
          <button onClick={() => setShowMenu(true)} className="text-gray-400 p-1">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M12 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
        </div>

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
            onClick={handleShareInvite}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center ml-1 flex-shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {debtReminder && showReminderBanner && (
          <div className="relative bg-amber-50 border border-amber-200 rounded-2xl p-3.5 pr-10">
            <button
              onClick={() => setShowReminderBanner(false)}
              className="absolute top-2 right-2 text-amber-500 text-xs"
              aria-label="Dismiss reminder"
            >
              ✕
            </button>
            <p className="text-amber-800 text-xs font-medium leading-relaxed">
              {USERS[debtReminder.to]?.display_name} is reminding you — you owe {formatMoney(debtReminder.amount)} in {group.name} ·{' '}
              <button
                onClick={() => handlePay(debtReminder)}
                className="text-emerald-600 font-bold"
              >
                Pay now →
              </button>
            </p>
          </div>
        )}

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
                  onRemind={handleRemind}
                />
              ))}
            </div>
          )}
        </div>

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
                <ExpenseRow key={exp.id} expense={exp} />
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav onFABPress={() => setShowQuickSplit(true)} groupId={id} />

      <BottomSheet isOpen={showQuickSplit} onClose={() => setShowQuickSplit(false)} title="Add Expense">
        <QuickSplit
          groupId={id}
          members={members}
          onSubmit={handleAddExpense}
          onClose={() => setShowQuickSplit(false)}
        />
      </BottomSheet>

      <BottomSheet isOpen={showMenu} onClose={() => setShowMenu(false)}>
        <div className="px-5 py-5 space-y-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-2 mb-3">{group.name}</p>

          <button
            onClick={async () => {
              await handleShareInvite()
              setShowMenu(false)
            }}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-gray-50 text-left"
          >
            <span className="text-xl w-8 text-center">🔗</span>
            <span className="font-semibold text-gray-800 text-sm">Share invite link</span>
          </button>

          <button
            onClick={() => {
              setShowMenu(false)
              navigate(`/groups/${id}/insights`)
            }}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-gray-50 text-left"
          >
            <span className="text-xl w-8 text-center">📊</span>
            <span className="font-semibold text-gray-800 text-sm">Insights</span>
          </button>

          <button
            onClick={() => {
              setShowMenu(false)
              setShowTelegramSheet(true)
            }}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-gray-50 text-left"
          >
            <span className="text-xl w-8 text-center">💬</span>
            <span className="font-semibold text-gray-800 text-sm">
              {telegramConnected ? '✅ Telegram Connected' : 'Connect Telegram'}
            </span>
          </button>

          <div className="border-t border-gray-100 mt-2 pt-2">
            <button className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl text-left">
              <span className="text-xl w-8 text-center">🗑️</span>
              <span className="font-semibold text-red-500 text-sm">Delete group</span>
            </button>
          </div>
        </div>
      </BottomSheet>

      <ConnectTelegramSheet
        isOpen={showTelegramSheet}
        onClose={() => setShowTelegramSheet(false)}
        groupName={group.name}
        isConnected={telegramConnected}
        telegramGroupName={telegramGroupName}
        isConnecting={isTelegramConnecting}
        code={telegramCode}
        onCopy={handleCopyTelegramCode}
        copied={telegramCodeCopied}
        onDisconnect={handleDisconnectTelegram}
      />
    </div>
  )
}
