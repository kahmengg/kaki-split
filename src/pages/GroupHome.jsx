import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import BottomSheet from '../components/BottomSheet'
import QuickSplit from './QuickSplit'
import { useToast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import {
  addExpense,
  createTelegramLinkToken,
  deleteGroup,
  disconnectTelegramConnection,
  fetchGroupData,
  fetchTelegramLinkToken,
  updateGroupName,
  updateTelegramSettings,
} from '../lib/fairsplitApi'
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

function SmartBalanceCard({ balance, usersById, currentUserId, onPay }) {
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

      {iOwe && (
        <button
          onClick={() => onPay(balance)}
          className="px-4 py-2 rounded-full bg-emerald-500 text-white font-bold text-sm active:scale-95 transition-transform"
          style={{ boxShadow: '0 2px 10px rgba(16,185,129,0.35)' }}
        >
          Pay
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
  codeExpiresAt,
  onCopy,
  copied,
  onDisconnect,
  settings,
  onToggleSetting,
  onRefreshCode,
}) {
  const expiresAtLabel = codeExpiresAt ? new Date(codeExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null

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

            <div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50 p-3.5">
              <label className="flex items-center justify-between text-sm text-gray-700">
                <span>Expense alerts</span>
                <input type="checkbox" checked={Boolean(settings?.expense_alerts_enabled)} onChange={(e) => onToggleSetting('expense_alerts_enabled', e.target.checked)} />
              </label>
              <label className="flex items-center justify-between text-sm text-gray-700">
                <span>Payment alerts</span>
                <input type="checkbox" checked={Boolean(settings?.payment_alerts_enabled)} onChange={(e) => onToggleSetting('payment_alerts_enabled', e.target.checked)} />
              </label>
              <label className="flex items-center justify-between text-sm text-gray-700">
                <span>Daily reminders (12:00 AM)</span>
                <input type="checkbox" checked={Boolean(settings?.daily_reminder_enabled)} onChange={(e) => onToggleSetting('daily_reminder_enabled', e.target.checked)} />
              </label>
            </div>

            <button onClick={onDisconnect} className="w-full py-3.5 rounded-full border border-gray-200 text-gray-700 font-semibold text-sm">
              Disconnect Telegram
            </button>
          </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">Get expense updates and debt reminders in your group chat.</p>

                <>
                  <div className="space-y-3 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold">1.</span> Add <span className="font-semibold">@kaki_split</span> to your Telegram group
                    </p>
                    <div>
                      <p className="mb-2">
                        <span className="font-semibold">2.</span> Send this command in the group:
                      </p>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-5 text-center">
                        <span className="font-mono font-black text-xl tracking-wide text-emerald-700">/link {code || '------'}</span>
                      </div>
                      {expiresAtLabel && <p className="mt-2 text-xs text-gray-500">Code expires at {expiresAtLabel}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={onCopy} className="px-4 py-2.5 rounded-full bg-emerald-500 text-white font-bold text-sm active:scale-95 transition-transform">
                      {copied ? 'Copied!' : 'Copy command'}
                    </button>
                    <button onClick={onRefreshCode} className="px-4 py-2.5 rounded-full border border-gray-200 text-gray-700 font-semibold text-sm">
                      Refresh code
                    </button>
                  </div>
                </>


              <div className="text-sm text-gray-500 flex items-center gap-2">
                <span>Waiting for connection...</span>
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              </div>

              {isConnecting && <p className="text-xs text-gray-400">Listening for @kaki_split confirmation...</p>}
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
  const [showEditGroupNameSheet, setShowEditGroupNameSheet] = useState(false)
  const [showReminderBanner, setShowReminderBanner] = useState(true)
  const [deletingGroup, setDeletingGroup] = useState(false)
  const [groupNameDraft, setGroupNameDraft] = useState('')
  const [savingGroupName, setSavingGroupName] = useState(false)
  const addExpenseInFlightRef = useRef(false)

  const [telegramConnected, setTelegramConnected] = useState(false)
  const [telegramGroupName, setTelegramGroupName] = useState(null)
  const [isTelegramConnecting, setIsTelegramConnecting] = useState(false)
  const [telegramCodeCopied, setTelegramCodeCopied] = useState(false)
  const [telegramCode, setTelegramCode] = useState('')
  const [telegramCodeDisplay, setTelegramCodeDisplay] = useState('')
  const [telegramCodeExpiresAt, setTelegramCodeExpiresAt] = useState(null)
  const [telegramSettings, setTelegramSettings] = useState({
    expense_alerts_enabled: true,
    payment_alerts_enabled: true,
    daily_reminder_enabled: true,
  })

  const loadGroup = async () => {
    if (!id || !user?.id) return

    setLoading(true)
    try {
        const data = await fetchGroupData({ groupId: id, userId: user.id })
        if (!data) {
          if (localStorage.getItem('kakisplit:lastGroupId') === id) {
            localStorage.removeItem('kakisplit:lastGroupId')
          }
          showToast('This group is no longer available', 'error')
          navigate('/dashboard', { replace: true })
          return
        }


          setGroup(data.group)
          setGroupNameDraft(data.group.name || '')
          setMembers(data.members)
          setUsersById(data.usersById)
          setExpenses(data.expenses)
          setBalances(data.smartBalances)
          setTelegramConnected(Boolean(data.group.telegram_connected))
        setTelegramGroupName(data.group.telegram_group_name || null)
        if (data.group.telegram_settings) {
          setTelegramSettings({
            expense_alerts_enabled: Boolean(data.group.telegram_settings.expense_alerts_enabled),
            payment_alerts_enabled: Boolean(data.group.telegram_settings.payment_alerts_enabled),
            daily_reminder_enabled: Boolean(data.group.telegram_settings.daily_reminder_enabled),
          })
        } else {
          setTelegramSettings({
            expense_alerts_enabled: true,
            payment_alerts_enabled: true,
            daily_reminder_enabled: true,
          })
        }

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
    if (!showTelegramSheet || telegramConnected || !group || !user?.id) return

    let cancelled = false

    const ensureToken = async () => {
      setIsTelegramConnecting(true)
      try {
        const existing = await fetchTelegramLinkToken({ groupId: group.id })
        const tokenData = existing || (await createTelegramLinkToken({ groupId: group.id, createdBy: user.id }))
        if (!cancelled) {
          setTelegramCode(tokenData.token || '')
          setTelegramCodeDisplay(tokenData.token || tokenData.formattedToken || '')
          setTelegramCodeExpiresAt(tokenData.expiresAt || null)
        }
      } catch (error) {
        if (!cancelled) {
          showToast(error.message || 'Unable to generate Telegram link code', 'error')
        }
      } finally {
        if (!cancelled) setIsTelegramConnecting(false)
      }
    }

    ensureToken()

    const interval = window.setInterval(async () => {
      try {
        const data = await fetchGroupData({ groupId: group.id, userId: user.id })
        if (!cancelled && data?.group?.telegram_connected) {
          setTelegramConnected(true)
          setTelegramGroupName(data.group.telegram_group_name || null)
          if (data.group.telegram_settings) {
            setTelegramSettings({
              expense_alerts_enabled: Boolean(data.group.telegram_settings.expense_alerts_enabled),
              payment_alerts_enabled: Boolean(data.group.telegram_settings.payment_alerts_enabled),
              daily_reminder_enabled: Boolean(data.group.telegram_settings.daily_reminder_enabled),
            })
          }
        }
      } catch {
        // ignore polling errors in sheet
      }
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [showTelegramSheet, telegramConnected, group, user?.id, showToast])

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
  const isOwner = group.created_by === user.id

  const handlePay = (balance) => {
    navigate(`/groups/${id}/pay?from=${balance.from}&to=${balance.to}&amount=${balance.amount}`)
  }

  const handleAddExpense = async (payload) => {
    if (addExpenseInFlightRef.current) return
    addExpenseInFlightRef.current = true

    try {
      await addExpense({
        groupId: id,
        amount: payload.amount,
        description: payload.description,
        category: payload.category,
        paidBy: payload.paid_by,
        splitMembers: payload.split_members,
          splitType: payload.split_type,
          splitValues: payload.split_values,
          currency: payload.currency,
          createdBy: user.id,
        })

      setShowQuickSplit(false)
      showToast('Expense added!', 'success')
      await loadGroup()
    } catch (error) {
      showToast(error.message || 'Unable to add expense', 'error')
    } finally {
      addExpenseInFlightRef.current = false
    }
  }

  const handleShareInvite = async () => {
    try {
      const origin = window.location.origin
      await navigator.clipboard.writeText(`${origin}/join/${group.invite_code}`)
      showToast('Invite link copied!', 'success')
    } catch {
      showToast('Unable to copy link', 'error')
    }
  }

  const handleRefreshTelegramCode = async () => {
    if (!group?.id || !user?.id) return

    try {
      setIsTelegramConnecting(true)
      const tokenData = await createTelegramLinkToken({ groupId: group.id, createdBy: user.id })
      setTelegramCode(tokenData.token || '')
      setTelegramCodeDisplay(tokenData.formattedToken || tokenData.token || '')
      setTelegramCodeExpiresAt(tokenData.expiresAt || null)
      setTelegramCodeCopied(false)
      showToast('New Telegram link code generated', 'success')
    } catch (error) {
      showToast(error.message || 'Unable to refresh Telegram code', 'error')
    } finally {
      setIsTelegramConnecting(false)
    }
  }


  const handleCopyTelegramCode = async () => {
    const command = telegramCode ? `/link ${telegramCode}` : ''
    try {
      if (!command) {
        showToast('Generate a code first', 'error')
        return
      }
      await navigator.clipboard.writeText(command)
      setTelegramCodeCopied(true)
      window.setTimeout(() => setTelegramCodeCopied(false), 1400)
    } catch {
      setTelegramCodeCopied(false)
    }
  }

  const handleToggleTelegramSetting = async (key, value) => {
    if (!group?.id) return

    const nextSettings = {
      ...telegramSettings,
      [key]: value,
    }

    setTelegramSettings(nextSettings)
    try {
      await updateTelegramSettings({
        groupId: group.id,
        settings: {
          ...nextSettings,
          reminder_timezone: 'Asia/Singapore',
        },
      })
      showToast('Telegram settings updated', 'success')
    } catch (error) {
      setTelegramSettings(telegramSettings)
      showToast(error.message || 'Unable to update Telegram settings', 'error')
    }
  }

  const handleDisconnectTelegram = async () => {
    if (!group?.id) return
    try {
      await disconnectTelegramConnection({ groupId: group.id })
      setTelegramConnected(false)
      setTelegramGroupName(null)
      setIsTelegramConnecting(false)
      setTelegramCode('')
      setTelegramCodeDisplay('')
      setTelegramCodeExpiresAt(null)
      setTelegramCodeCopied(false)
      showToast('Telegram disconnected', 'success')
      await loadGroup()
    } catch (error) {
      showToast(error.message || 'Unable to disconnect Telegram', 'error')
    }
  }

  const handleSaveGroupName = async () => {
    if (!group?.id || savingGroupName) return

    const trimmed = groupNameDraft.trim()
    if (!trimmed) {
      showToast('Group name cannot be empty', 'error')
      return
    }

    if (trimmed === group.name) {
      setShowEditGroupNameSheet(false)
      return
    }

    setSavingGroupName(true)
    try {
      const updated = await updateGroupName({ groupId: group.id, name: trimmed })
      setGroup((prev) => (prev ? { ...prev, name: updated?.name || trimmed } : prev))
      setGroupNameDraft(updated?.name || trimmed)
      showToast('Group name updated', 'success')
      setShowEditGroupNameSheet(false)
    } catch (error) {
      showToast(error.message || 'Unable to update group name', 'error')
    } finally {
      setSavingGroupName(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!group || !isOwner || deletingGroup) return

    const confirmed = window.confirm(`Delete "${group.name}" and all its expenses/payments? This cannot be undone.`)
    if (!confirmed) return

    setDeletingGroup(true)
    try {
      await deleteGroup({ groupId: group.id, userId: user.id })
      if (localStorage.getItem('kakisplit:lastGroupId') === group.id) {
        localStorage.removeItem('kakisplit:lastGroupId')
      }
      showToast('Group deleted', 'success')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      showToast(error.message || 'Unable to delete group', 'error')
    } finally {
      setDeletingGroup(false)
      setShowMenu(false)
    }
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
              setGroupNameDraft(group.name || '')
              setShowMenu(false)
              setShowEditGroupNameSheet(true)
            }}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-gray-50 text-left"
          >
            <span className="text-xl w-8 text-center">✏️</span>
            <span className="font-semibold text-gray-800 text-sm">Edit group name</span>
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

          <button
            onClick={handleDeleteGroup}
            disabled={!isOwner || deletingGroup}
            className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl text-left disabled:opacity-60 ${
              isOwner ? 'hover:bg-red-50' : 'hover:bg-gray-50'
            }`}
          >
            <span className="text-xl w-8 text-center">🗑️</span>
            <div className="min-w-0">
              <span className={`font-semibold text-sm ${isOwner ? 'text-red-600' : 'text-gray-500'}`}>
                {isOwner ? (deletingGroup ? 'Deleting group...' : 'Delete group') : 'Delete group (owner only)'}
              </span>
              {!isOwner && <p className="text-xs text-gray-400 mt-0.5">Ask the group owner to delete this group.</p>}
            </div>
          </button>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={showEditGroupNameSheet} onClose={() => setShowEditGroupNameSheet(false)} title="Edit group name">
        <div className="px-5 py-4 pb-8 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Group name</label>
            <input
              type="text"
              value={groupNameDraft}
              onChange={(e) => setGroupNameDraft(e.target.value)}
              maxLength={80}
              placeholder="Enter group name"
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditGroupNameSheet(false)}
              className="flex-1 py-3 rounded-full border border-gray-200 text-gray-700 font-semibold text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveGroupName}
              disabled={savingGroupName}
              className="flex-1 py-3 rounded-full bg-emerald-500 text-white font-bold text-sm disabled:opacity-60"
            >
              {savingGroupName ? 'Saving...' : 'Save'}
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
          code={telegramCodeDisplay}
          codeExpiresAt={telegramCodeExpiresAt}
          onCopy={handleCopyTelegramCode}
          copied={telegramCodeCopied}
          onDisconnect={handleDisconnectTelegram}
          settings={telegramSettings}
          onToggleSetting={handleToggleTelegramSetting}
          onRefreshCode={handleRefreshTelegramCode}
        />

      </div>

  )
}
