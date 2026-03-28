import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import BottomSheet from '../components/BottomSheet'
import QuickSplit from './QuickSplit'
import { useToast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { addExpense, createNudge, fetchGroupData } from '../lib/fairsplitApi'
import { formatMoney, getCategoryIcon, timeAgo } from '../lib/format'

function ExpenseRow({ expense, usersById, currentUserId }) {
  const paidBy = usersById[expense.paid_by]

  return (
    <div className="flex gap-3 py-3.5 border-b border-gray-50 last:border-0">
      <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl">{getCategoryIcon(expense.category)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{expense.description}</p>
            <p className="text-gray-400 text-xs mt-0.5 truncate">paid by {paidBy?.id === currentUserId ? 'You' : paidBy?.display_name || 'Unknown'}</p>
          </div>
          <p className="font-bold text-gray-900 text-sm text-right flex-shrink-0">{formatMoney(expense.amount)}</p>
        </div>
        <p className="text-gray-400 text-xs mt-1">{timeAgo(expense.created_at)}</p>
      </div>
    </div>
  )
}

function SmartBalanceCard({ balance, usersById, currentUserId, onPay, onRemind }) {
  const fromUser = usersById[balance.from]
  const toUser = usersById[balance.to]
  const iOwe = balance.from === currentUserId
  const owedToMe = balance.to === currentUserId

  if (!iOwe && !owedToMe) return null

  return (
    <div className={`flex items-center justify-between p-4 rounded-2xl border ${iOwe ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <Avatar user={iOwe ? toUser : fromUser} size="md" />
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">
            {iOwe ? `You owe ${toUser?.display_name || 'member'}` : `${fromUser?.display_name || 'Member'} owes you ${formatMoney(balance.amount)}`}
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
            <p className="text-sm text-gray-600 leading-relaxed">Get expense updates and debt reminders in your group chat.</p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <p className="text-emerald-800 font-semibold text-sm">✅ Connected to {telegramGroupName}</p>
              <p className="text-emerald-700 text-xs mt-1">Notifications are active for {groupName}.</p>
            </div>
            <button onClick={onDisconnect} className="w-full py-3.5 rounded-full border border-gray-200 text-gray-700 font-semibold text-sm">
              Disconnect Telegram
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">Get expense updates and debt reminders in your group chat.</p>

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

            <button onClick={onCopy} className="px-4 py-2.5 rounded-full bg-emerald-500 text-white font-bold text-sm active:scale-95 transition-transform">
              {copied ? 'Copied!' : 'Copy code'}
            </button>

              <div className="text-sm text-gray-500 flex items-center gap-2">
                <span>Waiting for Telegram bot confirmation...</span>
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              </div>

              {isConnecting && <p className="text-xs text-gray-400">Connect @FairSplitBot in Telegram to complete setup.</p>}

          </div>
        )}
      </div>
    </BottomSheet>
  )
}

export default function GroupHome() {
  const { id } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const { user } = useAuth()

  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [usersById, setUsersById] = useState({})
  const [expenses, setExpenses] = useState([])
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)

  const [showQuickSplit, setShowQuickSplit] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showTelegramSheet, setShowTelegramSheet] = useState(false)
  const [showReminderBanner, setShowReminderBanner] = useState(true)

  const [telegramConnected, setTelegramConnected] = useState(false)
  const [telegramGroupName, setTelegramGroupName] = useState(null)
  const [isTelegramConnecting, setIsTelegramConnecting] = useState(false)
  const [telegramCodeCopied, setTelegramCodeCopied] = useState(false)

  const telegramCode = useMemo(() => (group?.invite_code ? group.invite_code.slice(0, 6).toUpperCase() : ''), [group?.invite_code])

  const loadGroup = async () => {
    if (!id || !user?.id) return

    setLoading(true)
    try {
      const data = await fetchGroupData({ groupId: id, userId: user.id })
      if (!data) {
        setGroup(null)
        return
      }

      setGroup(data.group)
      setMembers(data.members)
      setUsersById(data.usersById)
      setExpenses(data.expenses)
      setBalances(data.smartBalances)
      setTelegramConnected(Boolean(data.group.telegram_connected))
      setTelegramGroupName(data.group.telegram_group_name || null)
    } catch (error) {
      showToast(error.message || 'Failed to load group', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id])

  useEffect(() => {
    if (!showTelegramSheet || !group) return

    setTelegramConnected(Boolean(group.telegram_connected))
    setTelegramGroupName(group.telegram_group_name || null)
    setIsTelegramConnecting(false)
  }, [showTelegramSheet, group])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-400">Group not found</p>
      </div>
    )
  }

  const myBalances = balances.filter((balance) => balance.from === user.id || balance.to === user.id)
  const allSettled = myBalances.length === 0
  const debtReminder = balances.find((balance) => balance.from === user.id)

  const handlePay = (balance) => {
    navigate(`/groups/${id}/pay?from=${balance.from}&to=${balance.to}&amount=${balance.amount}`)
  }

  const handleRemind = async (balance) => {
    try {
      await createNudge({ groupId: group.id, fromUserId: user.id, toUserId: balance.from, amount: balance.amount })
      const debtor = usersById[balance.from]
      showToast(`Reminder sent to ${debtor?.display_name || 'member'}`, 'success')
    } catch (error) {
      showToast(error.message || 'Unable to send reminder', 'error')
    }
  }

  const handleAddExpense = async (payload) => {
    try {
      await addExpense({
        groupId: id,
        amount: payload.amount,
        description: payload.description,
        category: payload.category,
        paidBy: payload.paid_by,
        splitMembers: payload.split_members,
        splitType: payload.split_type,
        currency: payload.currency,
        createdBy: user.id,
      })

      setShowQuickSplit(false)
      showToast('Expense added!', 'success')
      await loadGroup()
    } catch (error) {
      showToast(error.message || 'Unable to add expense', 'error')
    }
  }

  const handleShareInvite = async () => {
    try {
        const inviteUrl = `${window.location.origin}/#/join/${group.invite_code}`

      await navigator.clipboard.writeText(inviteUrl)
      showToast('Invite link copied!', 'success')
    } catch {
      showToast('Unable to copy link', 'error')
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
          {members.map((member) => (
            <div key={member.id} className="flex flex-col items-center gap-1">
              <Avatar user={member} size="sm" ring={member.id === user.id} />
              <span className="text-[10px] text-gray-400 font-medium">{member.id === user.id ? 'You' : member.display_name.split(' ')[0]}</span>
            </div>
          ))}
          <button onClick={handleShareInvite} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center ml-1 flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {debtReminder && showReminderBanner && (
          <div className="relative bg-amber-50 border border-amber-200 rounded-2xl p-3.5 pr-10">
            <button onClick={() => setShowReminderBanner(false)} className="absolute top-2 right-2 text-amber-500 text-xs" aria-label="Dismiss reminder">
              ✕
            </button>
            <p className="text-amber-800 text-xs font-medium leading-relaxed">
              {usersById[debtReminder.to]?.display_name || 'A member'} is reminding you — you owe {formatMoney(debtReminder.amount)} in {group.name} ·{' '}
              <button onClick={() => handlePay(debtReminder)} className="text-emerald-600 font-bold">
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
              {myBalances.map((balance) => (
                <SmartBalanceCard
                  key={`${balance.from}-${balance.to}`}
                  balance={balance}
                  usersById={usersById}
                  currentUserId={user.id}
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
              {expenses.map((expense) => (
                <ExpenseRow key={expense.id} expense={expense} usersById={usersById} currentUserId={user.id} />
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav onFABPress={() => setShowQuickSplit(true)} groupId={id} />

      <BottomSheet isOpen={showQuickSplit} onClose={() => setShowQuickSplit(false)} title="Add Expense">
        <QuickSplit members={members} currentUserId={user.id} onSubmit={handleAddExpense} />
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
            <span className="font-semibold text-gray-800 text-sm">{telegramConnected ? '✅ Telegram Connected' : 'Connect Telegram'}</span>
          </button>
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
