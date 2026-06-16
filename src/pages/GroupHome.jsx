import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import BottomSheet from '../components/BottomSheet'
import ThemeToggle from '../components/ThemeToggle'
import QuickSplit from './QuickSplit'
import { useToast } from '../components/Toast'
import { useAppQueryInvalidation, useGroupData } from '../hooks/useAppQueries'
import { useAuth } from '../hooks/useAuth'
import {
  addExpense,
  createTelegramLinkToken,
  deleteGroupActivityItem,
  disconnectTelegramConnection,
  fetchDeletedActivityLogs,
  fetchGroupData,
  fetchTelegramLinkToken,
  updateGroupName,
  updateTelegramSettings,
} from '../lib/kakiSplitApi'
import { formatMoney, getCategoryIcon, timeAgo } from '../lib/format'

function ExpenseRow({ expense, usersById, currentUserId, groupBaseCurrency, forceBaseCurrency = false }) {
  const paidBy = usersById[expense.paid_by]
  const settledCurrency = groupBaseCurrency || 'SGD'
  const originalCurrency = String(expense.original_currency || settledCurrency).trim().toUpperCase()
  const originalAmount = Number(expense.original_amount || 0)
  const settledAmount = Number(expense.amount || 0)
  const hasOriginalAmount = Number.isFinite(originalAmount) && originalAmount > 0

  const exchangeRate = Number(expense.exchange_rate || 0)
  const hasConvertedAmount =
    hasOriginalAmount &&
    originalCurrency !== settledCurrency &&
    Number.isFinite(exchangeRate) &&
    exchangeRate > 0

    const shouldShowOriginal = hasConvertedAmount && !forceBaseCurrency
    const displayCurrency = shouldShowOriginal ? originalCurrency : settledCurrency
    const totalDisplayAmount = shouldShowOriginal ? originalAmount : settledAmount

    const myShareSettled = Number((expense.splits || []).find((split) => split.user_id === currentUserId)?.amount || 0)
    const myShareDisplay = shouldShowOriginal ? myShareSettled / exchangeRate : myShareSettled
  const normalizedMyShare = Number.isFinite(myShareDisplay) && myShareDisplay > 0 ? myShareDisplay : 0
  const personalSummary = `Your share ${formatMoney(normalizedMyShare, displayCurrency)}`

  return (
    <div className="flex gap-3 py-3.5 border-b border-gray-50 last:border-0">
      <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl">{getCategoryIcon(expense.category)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{expense.description}</p>
              <p className="text-gray-500 text-xs mt-0.5 truncate">Paid by {paidBy?.id === currentUserId ? 'You' : paidBy?.display_name || 'Unknown'}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-gray-900 text-sm">{formatMoney(totalDisplayAmount, displayCurrency)}</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-1 truncate">{personalSummary}</p>


      </div>
    </div>
  )
}

function PaymentRow({ payment, usersById, currentUserId, currency }) {
  const fromUser = usersById[payment.from_user_id]
  const toUser = usersById[payment.to_user_id]
  const fromLabel = payment.from_user_id === currentUserId ? 'You' : fromUser?.display_name || 'Member'
  const toLabel = payment.to_user_id === currentUserId ? 'you' : toUser?.display_name || 'Member'

  return (
    <div className="flex gap-3 py-3.5 border-b border-gray-50 last:border-0">
      <div className="w-10 h-10 bg-sky-50 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl">ðŸ’¸</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">Payment recorded</p>
            <p className="text-gray-500 text-xs mt-0.5 truncate">{fromLabel} paid {toLabel}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-gray-900 text-sm">{formatMoney(payment.amount, currency || 'SGD')}</p>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-1 truncate">{timeAgo(payment.created_at)}</p>
      </div>
    </div>
  )
}

function SwipeDeleteRow({ children, canDelete, onDelete }) {
  const [offset, setOffset] = useState(0)
  const startXRef = useRef(null)
  const maxOffset = -86

  const handlePointerDown = (event) => {
    if (!canDelete) return
    startXRef.current = event.clientX
  }

  const handlePointerMove = (event) => {
    if (!canDelete || startXRef.current === null) return
    const delta = event.clientX - startXRef.current
    setOffset(Math.max(maxOffset, Math.min(0, delta)))
  }

  const handlePointerUp = () => {
    if (!canDelete || startXRef.current === null) return
    setOffset((current) => (current < -42 ? maxOffset : 0))
    startXRef.current = null
  }

  if (!canDelete) return children

  return (
    <div className="relative overflow-hidden border-b border-gray-50 last:border-0">
      <button
        type="button"
        onClick={() => {
          setOffset(0)
          onDelete()
        }}
        className="absolute inset-y-0 right-0 w-[86px] bg-red-500 text-white text-xs font-bold flex items-center justify-center"
      >
        Delete
      </button>
      <div
        className="relative bg-white touch-pan-y transition-transform"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {children}
      </div>
    </div>
  )
}

function SmartBalanceCard({ balance, usersById, currentUserId, onPay, currency }) {
  const fromUser = usersById[balance.from]
  const toUser = usersById[balance.to]
  const iOwe = balance.from === currentUserId
  const owedToMe = balance.to === currentUserId

  if (!iOwe && !owedToMe) return null

  return (
    <div className={`flex items-center justify-between p-4 rounded-2xl border ${iOwe ? 'bg-red-50 border-red-100' : 'bg-sky-50 border-sky-100'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <Avatar user={iOwe ? toUser : fromUser} size="md" />
        <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">
              {iOwe
                ? `You owe ${toUser?.display_name || 'member'}`
                : `${fromUser?.display_name || 'Member'} owes you ${formatMoney(balance.amount, currency || 'SGD')}`}
            </p>
            {iOwe && <p className="font-black text-lg text-red-500">{formatMoney(balance.amount, currency || 'SGD')}</p>}

        </div>
      </div>

      {iOwe && (
        <button
          onClick={() => onPay(balance)}
          className="px-4 py-2 rounded-full bg-sky-500 text-white font-bold text-sm active:scale-95 transition-transform"
          style={{ boxShadow: '0 2px 10px rgba(14,165,233,0.35)' }}
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
  botUsername,
  onOpenTelegram,
}) {
  const expiresAtLabel = codeExpiresAt ? new Date(codeExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Connect Telegram">
      <div className="px-5 py-4 pb-8">
        {isConnected ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">Get expense updates and debt reminders in your group chat.</p>
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
              <p className="text-sky-800 font-semibold text-sm">âœ… Connected to {telegramGroupName}</p>
              <p className="text-sky-700 text-xs mt-1">Notifications are active for {groupName}.</p>
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
                        <span className="font-semibold">1.</span> Add <span className="font-semibold">@{botUsername || 'kaki_split_bot'}</span> to your Telegram group
                      </p>

                    <div>
                      <p className="mb-2">
                        <span className="font-semibold">2.</span> Send this command in the group:
                      </p>
                      <div className="bg-sky-50 border border-sky-200 rounded-2xl px-4 py-5 text-center">
                        <span className="font-mono font-black text-xl tracking-wide text-sky-700">/link {code || '------'}</span>
                      </div>
                      {expiresAtLabel && <p className="mt-2 text-xs text-gray-500">Code expires at {expiresAtLabel}</p>}
                    </div>
                  </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={onCopy} className="px-4 py-2.5 rounded-full bg-sky-500 text-white font-bold text-sm active:scale-95 transition-transform">
                        {copied ? 'Copied!' : 'Copy command'}
                      </button>
                      <button onClick={onOpenTelegram} className="px-4 py-2.5 rounded-full border border-sky-200 text-sky-700 font-semibold text-sm">
                        Open Telegram
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

                {isConnecting && <p className="text-xs text-gray-400">Listening for @{botUsername || 'kaki_split_bot'} confirmation...</p>}

            </div>
          )}
      </div>
    </BottomSheet>
  )
  }

function TelegramOnboardingSheet({ isOpen, onClose, groupName, botUsername, code, codeExpiresAt, copied, onCopy, onOpenTelegram, onOpenConnect }) {
  const expiresAtLabel = codeExpiresAt ? new Date(codeExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Set up Telegram reminders">
      <div className="px-5 py-4 pb-8 space-y-4">
        <p className="text-sm text-gray-600 leading-relaxed">Want automatic debt reminders for {groupName}? Connect Telegram in under 1 minute.</p>

        <div className="space-y-3 text-sm text-gray-700">
          <p>
            <span className="font-semibold">1.</span> Add <span className="font-semibold">@{botUsername || 'kaki_split_bot'}</span> into your Telegram group.
          </p>
          <p>
            <span className="font-semibold">2.</span> Send this command in that group:
          </p>
          <div className="bg-sky-50 border border-sky-200 rounded-2xl px-4 py-5 text-center">
            <span className="font-mono font-black text-xl tracking-wide text-sky-700">/link {code || '------'}</span>
          </div>
          {expiresAtLabel && <p className="text-xs text-gray-500">Code expires at {expiresAtLabel}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onCopy} className="px-4 py-2.5 rounded-full bg-sky-500 text-white font-bold text-sm active:scale-95 transition-transform">
            {copied ? 'Copied!' : 'Copy command'}
          </button>
          <button onClick={onOpenTelegram} className="px-4 py-2.5 rounded-full border border-sky-200 text-sky-700 font-semibold text-sm">
            Open Telegram
          </button>
        </div>

        <button onClick={onOpenConnect} className="w-full py-3.5 rounded-full border border-gray-200 text-gray-700 font-semibold text-sm">
          Open full Telegram settings
        </button>
      </div>
    </BottomSheet>
  )
}

export default function GroupHome() {

  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()
  const { user } = useAuth()
  const { invalidateGroup } = useAppQueryInvalidation()
  const groupQuery = useGroupData({ groupId: id, userId: user?.id })

  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [usersById, setUsersById] = useState({})
  const [expenses, setExpenses] = useState([])
  const [payments, setPayments] = useState([])
  const [balances, setBalances] = useState([])

  const [showQuickSplit, setShowQuickSplit] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showTelegramSheet, setShowTelegramSheet] = useState(false)
  const [showTelegramOnboarding, setShowTelegramOnboarding] = useState(false)
  const [showEditGroupNameSheet, setShowEditGroupNameSheet] = useState(false)
  const [showDeletedLogsSheet, setShowDeletedLogsSheet] = useState(false)
  const [deletedLogs, setDeletedLogs] = useState([])
  const [loadingDeletedLogs, setLoadingDeletedLogs] = useState(false)
  const [showReminderBanner, setShowReminderBanner] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletingActivityItem, setDeletingActivityItem] = useState(false)
  const [groupNameDraft, setGroupNameDraft] = useState('')
  const [savingGroupName, setSavingGroupName] = useState(false)
  const addExpenseInFlightRef = useRef(false)

  const [telegramConnected, setTelegramConnected] = useState(false)
  const [telegramGroupName, setTelegramGroupName] = useState(null)
  const [showAllInBaseCurrency, setShowAllInBaseCurrency] = useState(false)
  const [isTelegramConnecting, setIsTelegramConnecting] = useState(false)
  const [telegramCodeCopied, setTelegramCodeCopied] = useState(false)
  const [telegramCode, setTelegramCode] = useState('')
  const [telegramCodeDisplay, setTelegramCodeDisplay] = useState('')
  const [telegramCodeExpiresAt, setTelegramCodeExpiresAt] = useState(null)
  const [telegramBotUsername, setTelegramBotUsername] = useState('kaki_split_bot')
  const [telegramSettings, setTelegramSettings] = useState({
    expense_alerts_enabled: true,
    payment_alerts_enabled: true,
    daily_reminder_enabled: true,
  })
  const onboardingHandledRef = useRef(false)

  const applyGroupData = (data) => {
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
            setPayments(data.payments || [])
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
  }

  useEffect(() => {
    if (groupQuery.data) applyGroupData(groupQuery.data)
  }, [groupQuery.data])

  useEffect(() => {
    if (groupQuery.error) {
      showToast(groupQuery.error.message || 'Failed to load group', 'error')
    }
  }, [groupQuery.error, showToast])

  useEffect(() => {
    if (!group?.id || telegramConnected || onboardingHandledRef.current) return

    const shouldPrompt = Boolean(location.state?.openTelegramOnboarding)
    if (!shouldPrompt) return

    onboardingHandledRef.current = true
    setShowTelegramOnboarding(true)
    navigate(location.pathname, { replace: true, state: {} })
  }, [group?.id, telegramConnected, location.pathname, location.state, navigate])

  useEffect(() => {
    if ((!showTelegramSheet && !showTelegramOnboarding) || telegramConnected || !group || !user?.id) return

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
          setTelegramBotUsername(tokenData.botUsername || 'kaki_split_bot')
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
        const data = await fetchGroupData({ groupId: group.id, userId: user.id, skipCache: true })
        if (!cancelled && data?.group?.telegram_connected) {
          setTelegramConnected(true)
          setTelegramGroupName(data.group.telegram_group_name || null)
          setShowTelegramOnboarding(false)
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
  }, [showTelegramSheet, showTelegramOnboarding, telegramConnected, group, user?.id, showToast])

  if (groupQuery.isLoading && !group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
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

  const activityItems = [
    ...expenses.map((expense) => ({
      id: expense.id,
      type: 'expense',
      createdAt: expense.created_at,
      label: expense.description || 'Expense',
      amount: expense.amount,
      item: expense,
    })),
    ...payments.map((payment) => ({
      id: payment.id,
      type: 'payment',
      createdAt: payment.created_at,
      label: 'Payment recorded',
      amount: payment.amount,
      item: payment,
    })),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
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
          baseCurrency: group.base_currency,
          createdBy: user.id,
        })


      setShowQuickSplit(false)
      showToast('Expense added!', 'success')
      await invalidateGroup({ groupId: id, userId: user.id })
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
        setTelegramBotUsername(tokenData.botUsername || 'kaki_split_bot')
        setTelegramCodeCopied(false)
        showToast('New Telegram link code generated', 'success')
      } catch (error) {
        showToast(error.message || 'Unable to refresh Telegram code', 'error')
      } finally {
        setIsTelegramConnecting(false)
      }
    }

    const handleOpenTelegram = () => {
      const username = String(telegramBotUsername || '').trim() || 'kaki_split_bot'
      window.open(`https://t.me/${username}`, '_blank', 'noopener,noreferrer')
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
      await invalidateGroup({ groupId: group.id, userId: user.id })
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
      await invalidateGroup({ groupId: group.id, userId: user.id })
    } catch (error) {
      showToast(error.message || 'Unable to update group name', 'error')
    } finally {
      setSavingGroupName(false)
    }
  }

  const handleOpenDeletedLogs = async () => {
    if (!group?.id) return

    setShowMenu(false)
    setShowDeletedLogsSheet(true)
    setLoadingDeletedLogs(true)
    try {
      const logs = await fetchDeletedActivityLogs({ groupId: group.id })
      setDeletedLogs(logs)
    } catch (error) {
      showToast(error.message || 'Unable to load deleted logs', 'error')
    } finally {
      setLoadingDeletedLogs(false)
    }
  }

  const handleConfirmDeleteActivityItem = async () => {
    if (!group?.id || !deleteTarget || deletingActivityItem) return

    setDeletingActivityItem(true)
    try {
      await deleteGroupActivityItem({
        groupId: group.id,
        itemType: deleteTarget.type,
        itemId: deleteTarget.id,
      })
      showToast(`${deleteTarget.type === 'payment' ? 'Payment' : 'Expense'} deleted`, 'success')
      setDeleteTarget(null)
      await invalidateGroup({ groupId: group.id, userId: user.id })
    } catch (error) {
      showToast(error.message || 'Unable to delete activity item', 'error')
    } finally {
      setDeletingActivityItem(false)
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
                  {members.length} members Â· {formatMoney(group.total_spent, group.base_currency)} total
                </p>

            </div>
            <ThemeToggle className="px-2.5" />
            <button onClick={() => setShowMenu(true)} className="text-gray-400 p-1">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                <path d="M12 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          </div>


          <div className="flex items-start gap-1.5 flex-wrap">
            {members.map((member) => {
              const chipLabel = member.id === user.id ? 'You' : member.display_name.split(' ')[0]

              return (
                <div key={member.id} className="w-14 flex flex-col items-center gap-1">
                  <Avatar user={member} size="sm" ring={member.id === user.id} />
                  <span className="w-full text-center text-[10px] text-gray-400 font-medium truncate px-0.5">{chipLabel}</span>
                </div>
              )
            })}
            <button onClick={handleShareInvite} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center ml-1 flex-shrink-0">

            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </div>

        <div className="px-4 pt-4 space-y-3">
          {!telegramConnected && (
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sky-900 text-sm font-semibold">Connect Telegram for reminders</p>
                <p className="text-sky-700 text-xs mt-0.5">Add @{telegramBotUsername} to your group and link with your code.</p>
              </div>
              <button
                onClick={() => setShowTelegramSheet(true)}
                className="px-3 py-2 rounded-full bg-white border border-sky-200 text-sky-700 text-xs font-bold flex-shrink-0"
              >
                Connect
              </button>
            </div>
          )}

          {debtReminder && showReminderBanner && (

          <div className="relative bg-amber-50 border border-amber-200 rounded-2xl p-3.5 pr-10">
            <button onClick={() => setShowReminderBanner(false)} className="absolute top-2 right-2 text-amber-500 text-xs" aria-label="Dismiss reminder">
              âœ•
            </button>
              <p className="text-amber-800 text-xs font-medium leading-relaxed">
                {usersById[debtReminder.to]?.display_name || 'A member'} is reminding you â€” you owe {formatMoney(debtReminder.amount, group.base_currency)} in {group.name} Â·{' '}
                <button onClick={() => handlePay(debtReminder)} className="text-sky-600 font-bold">
                  Pay now â†’
                </button>
              </p>

          </div>
        )}

        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">Your balances</p>
          {allSettled ? (
            <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 text-center">
              <p className="text-2xl mb-1">âœ…</p>
              <p className="text-sky-700 font-bold text-sm">All settled up!</p>
              <p className="text-sky-500 text-xs mt-0.5">Everyone's even on this trip</p>
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
                      currency={group.base_currency}
                    />

                ))}

            </div>
          )}
        </div>

          <div>
            <div className="flex items-center justify-between mb-2 px-1 gap-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Activity</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAllInBaseCurrency((value) => !value)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                    showAllInBaseCurrency
                      ? 'bg-sky-50 border-sky-300 text-sky-700'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {showAllInBaseCurrency ? `Showing ${group.base_currency}` : `Show all in ${group.base_currency}`}
                </button>
                <span className="text-xs text-gray-400">{activityItems.length} items</span>
              </div>
            </div>

            {activityItems.length === 0 ? (
              <div className="text-center py-10 px-4 bg-white rounded-2xl border border-gray-100">
                <p className="text-4xl mb-3">KS</p>
                <p className="font-bold text-gray-900 mb-1">No activity yet</p>
                <p className="text-gray-500 text-sm">Tap + to add the first one</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {activityItems.map((activityItem) => (
                  <SwipeDeleteRow
                    key={`${activityItem.type}-${activityItem.id}`}
                    canDelete={isOwner}
                    onDelete={() => setDeleteTarget(activityItem)}
                  >
                    <div className="px-4">
                      {activityItem.type === 'payment' ? (
                        <PaymentRow payment={activityItem.item} usersById={usersById} currentUserId={user.id} currency={group.base_currency} />
                      ) : (
                        <ExpenseRow
                          expense={activityItem.item}
                          usersById={usersById}
                          currentUserId={user.id}
                          groupBaseCurrency={group.base_currency}
                          forceBaseCurrency={showAllInBaseCurrency}
                        />
                      )}
                    </div>
                  </SwipeDeleteRow>
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
            <span className="text-xl w-8 text-center">&#128279;</span>
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
            <span className="text-xl w-8 text-center">&#9999;</span>
            <span className="font-semibold text-gray-800 text-sm">Edit group name</span>
          </button>

          <button
            onClick={handleOpenDeletedLogs}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-gray-50 text-left"
          >
            <span className="text-xl w-8 text-center">&#128220;</span>
            <span className="font-semibold text-gray-800 text-sm">View deleted logs</span>
          </button>

          <button
            onClick={() => {
              setShowMenu(false)
              setShowTelegramSheet(true)
            }}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-gray-50 text-left"
          >
            <span className="text-xl w-8 text-center">&#128172;</span>
            <span className="font-semibold text-gray-800 text-sm">{telegramConnected ? '✓ Telegram Connected' : 'Connect Telegram'}</span>
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
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
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
                className="flex-1 py-3 rounded-full bg-sky-500 text-white font-bold text-sm disabled:opacity-60"
              >
                {savingGroupName ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </BottomSheet>

        <BottomSheet isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete activity item">
          <div className="px-5 py-4 pb-8 space-y-4">
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Confirm deletion</p>
              <p className="text-sm text-red-700">
                Delete {deleteTarget?.label || 'this item'}? This updates balances and keeps a deleted log for 1 month.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 rounded-full border border-gray-200 text-gray-700 font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteActivityItem}
                disabled={deletingActivityItem}
                className="flex-1 py-3 rounded-full bg-red-500 text-white font-bold text-sm disabled:opacity-60"
              >
                {deletingActivityItem ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </BottomSheet>

        <BottomSheet isOpen={showDeletedLogsSheet} onClose={() => setShowDeletedLogsSheet(false)} title="Deleted logs">
          <div className="px-5 py-4 pb-8 space-y-3">
            {loadingDeletedLogs ? (
              <div className="py-8 flex justify-center">
                <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
              </div>
            ) : deletedLogs.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-5 text-center">
                <p className="font-bold text-gray-900 text-sm">No deleted logs</p>
                <p className="text-xs text-gray-500 mt-1">Deleted expenses and payments appear here for 1 month.</p>
              </div>
            ) : (
              deletedLogs.map((log) => {
                const snapshot = log.item_snapshot || {}
                const deletedBy = log.profiles?.display_name || log.profiles?.email || 'Member'
                const title = log.item_type === 'payment' ? 'Payment recorded' : snapshot.description || 'Expense'
                const amount = Number(snapshot.amount || 0)
                const currency = snapshot.original_currency || group.base_currency || 'SGD'
                const expiresLabel = log.expires_at ? new Date(log.expires_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) : 'soon'

                return (
                  <div key={log.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{log.item_type}</p>
                        <p className="font-bold text-gray-900 text-sm truncate mt-0.5">{title}</p>
                        <p className="text-xs text-gray-500 mt-1">Deleted by {deletedBy} · {timeAgo(log.deleted_at)}</p>
                      </div>
                      <p className="font-bold text-gray-900 text-sm flex-shrink-0">{formatMoney(amount, currency)}</p>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">Expires {expiresLabel}</p>
                  </div>
                )
              })
            )}
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
            botUsername={telegramBotUsername}
            onOpenTelegram={handleOpenTelegram}
          />

          <TelegramOnboardingSheet
            isOpen={showTelegramOnboarding && !telegramConnected}
            onClose={() => setShowTelegramOnboarding(false)}
            groupName={group.name}
            botUsername={telegramBotUsername}
            code={telegramCodeDisplay}
            codeExpiresAt={telegramCodeExpiresAt}
            copied={telegramCodeCopied}
            onCopy={handleCopyTelegramCode}
            onOpenTelegram={handleOpenTelegram}
            onOpenConnect={() => {
              setShowTelegramOnboarding(false)
              setShowTelegramSheet(true)
            }}
          />

        </div>


  )
}









