import { adminSupabase } from './db.js'

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function toDateInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value || '1970'
  const month = parts.find((part) => part.type === 'month')?.value || '01'
  const day = parts.find((part) => part.type === 'day')?.value || '01'

  return `${year}-${month}-${day}`
}

async function sendTelegramMessage({ botToken, chatId, text }) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  })

  const result = await response.json().catch(() => null)
  return { ok: response.ok && result?.ok, status: response.status, result }
}

function toPendingRetryTimestamp() {
  return new Date(Date.now() + 2 * 60 * 1000).toISOString()
}

const DEFAULT_APP_URL = 'https://kaki-split.vercel.app'

function normalizeUrl(url) {
  return String(url || '')
    .trim()
    .replace(/^https?:\/\//, 'https://')
    .replace(/\/+$/, '')
}

function getAppUrl() {
  const configuredUrl = normalizeUrl(process.env.APP_URL || process.env.WEB_APP_URL || process.env.NEXT_PUBLIC_APP_URL || '')
  if (configuredUrl) return configuredUrl

  const productionVercelUrl = normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL || '')
  if (productionVercelUrl) return productionVercelUrl

  return DEFAULT_APP_URL
}

function shouldDisableConnection(sendResult) {
  const description = String(sendResult?.result?.description || '').toLowerCase()
  return (
    description.includes('chat not found') ||
    description.includes('group chat was upgraded') ||
    description.includes('bot was kicked') ||
    description.includes('forbidden')
  )
}

function isMissingColumnError(error) {
  return ['42703', 'PGRST204'].includes(String(error?.code || ''))
}

function parseBooleanSetting(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (['on', 'true', 'yes', 'enable', 'enabled', '1'].includes(normalized)) return true
  if (['off', 'false', 'no', 'disable', 'disabled', '0'].includes(normalized)) return false
  return null
}

function parseReminderTime(value) {
  const normalized = String(value || '').trim().toLowerCase()
  const match = normalized.match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/)
  if (!match) return null

  let hour = Number(match[1])
  const minute = Number(match[2] || 0)
  const meridiem = match[3]

  if (meridiem === 'pm' && hour < 12) hour += 12
  if (meridiem === 'am' && hour === 12) hour = 0

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null

  return { hour, minute }
}

function parseReminderInterval(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null
  if (['daily', 'day', '1', '1d', '1day'].includes(normalized)) return 1

  const match = normalized.match(/^(\d{1,2})\s*(d|day|days)?$/)
  if (!match) return null

  const days = Number(match[1])
  if (!Number.isInteger(days) || days < 1 || days > 30) return null
  return days
}

function formatReminderTime(connection) {
  const hour = Number(connection?.reminder_hour ?? 0)
  const minute = Number(connection?.reminder_minute ?? 0)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formatTelegramSettings(connection) {
  const interval = Number(connection?.reminder_interval_days || 1)
  const intervalLabel = interval === 1 ? 'daily' : `every ${interval} days`
  return [
    'Kaki Split alert settings:',
    `All alerts: ${connection?.is_active ? 'on' : 'off'}`,
    `Expense alerts: ${connection?.expense_alerts_enabled ? 'on' : 'off'}`,
    `Payment alerts: ${connection?.payment_alerts_enabled ? 'on' : 'off'}`,
    `Reminders: ${connection?.daily_reminder_enabled ? 'on' : 'off'}`,
    `Reminder time: ${formatReminderTime(connection)} ${connection?.reminder_timezone || 'Asia/Singapore'}`,
    `Reminder frequency: ${intervalLabel}`,
    '',
    'Commands:',
    '/alerts on',
    '/alerts off',
    '/alerts expense on',
    '/alerts payment off',
    '/alerts reminders on',
    '/alerts time 09:30',
    '/alerts every 2 days',
    '/alerts status',
  ].join('\n')
}

async function findConnectionForChat(chatId) {
  const { data, error } = await adminSupabase
    .from('telegram_connections')
    .select(
      'group_id,telegram_chat_id,telegram_group_name,is_active,expense_alerts_enabled,payment_alerts_enabled,daily_reminder_enabled,reminder_hour,reminder_minute,reminder_timezone,reminder_interval_days'
    )
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (error) {
    if (isMissingColumnError(error)) {
      const fallback = await adminSupabase
        .from('telegram_connections')
        .select(
          'group_id,telegram_chat_id,telegram_group_name,is_active,expense_alerts_enabled,payment_alerts_enabled,daily_reminder_enabled,reminder_hour,reminder_minute,reminder_timezone'
        )
        .eq('telegram_chat_id', chatId)
        .maybeSingle()

      if (fallback.error) throw fallback.error
      return fallback.data ? { ...fallback.data, reminder_interval_days: 1 } : null
    }
    throw error
  }

  return data ? { ...data, reminder_interval_days: data.reminder_interval_days || 1 } : null
}

async function updateConnectionSettings({ chatId, update }) {
  let response = await adminSupabase
    .from('telegram_connections')
    .update(update)
    .eq('telegram_chat_id', chatId)
    .select(
      'group_id,telegram_chat_id,telegram_group_name,is_active,expense_alerts_enabled,payment_alerts_enabled,daily_reminder_enabled,reminder_hour,reminder_minute,reminder_timezone,reminder_interval_days'
    )
    .maybeSingle()

  if (isMissingColumnError(response.error) && Object.prototype.hasOwnProperty.call(update, 'reminder_interval_days')) {
    const legacyUpdate = { ...update }
    delete legacyUpdate.reminder_interval_days
    response = await adminSupabase
      .from('telegram_connections')
      .update(legacyUpdate)
      .eq('telegram_chat_id', chatId)
      .select(
        'group_id,telegram_chat_id,telegram_group_name,is_active,expense_alerts_enabled,payment_alerts_enabled,daily_reminder_enabled,reminder_hour,reminder_minute,reminder_timezone'
      )
      .maybeSingle()
  }

  if (response.error) throw response.error
  return response.data ? { ...response.data, reminder_interval_days: response.data.reminder_interval_days || update.reminder_interval_days || 1 } : null
}

async function handleAlertsCommand({ botToken, chat, text }) {
  const commandMatch = text.match(/^\/(?:alerts|notifications?)(?:@\w+)?(?:\s+([\s\S]+))?$/i)
  if (!commandMatch) return null

  const connection = await findConnectionForChat(chat.id)
  if (!connection) {
    await sendTelegramMessage({
      botToken,
      chatId: chat.id,
      text: 'This Telegram group is not linked yet. Generate a link code in Kaki Split, then send /link <code> here.',
    })
    return { ok: false, error: 'Chat is not linked' }
  }

  const args = String(commandMatch[1] || 'status').trim()
  const parts = args.split(/\s+/).filter(Boolean)
  const primary = String(parts[0] || 'status').toLowerCase()
  const secondary = String(parts[1] || '').toLowerCase()
  let update = null
  let successMessage = ''

  if (primary === 'help' || primary === 'status') {
    await sendTelegramMessage({ botToken, chatId: chat.id, text: formatTelegramSettings(connection) })
    return { ok: true, action: 'alerts_status' }
  }

  const allValue = parseBooleanSetting(primary)
  if (allValue !== null) {
    update = {
      is_active: allValue,
      expense_alerts_enabled: allValue,
      payment_alerts_enabled: allValue,
      daily_reminder_enabled: allValue,
    }
    successMessage = `All Kaki Split alerts are now ${allValue ? 'on' : 'off'}.`
  } else if (['expense', 'expenses'].includes(primary)) {
    const enabled = parseBooleanSetting(secondary)
    if (enabled !== null) {
      update = { expense_alerts_enabled: enabled, is_active: true }
      successMessage = `Expense alerts are now ${enabled ? 'on' : 'off'}.`
    }
  } else if (['payment', 'payments'].includes(primary)) {
    const enabled = parseBooleanSetting(secondary)
    if (enabled !== null) {
      update = { payment_alerts_enabled: enabled, is_active: true }
      successMessage = `Payment alerts are now ${enabled ? 'on' : 'off'}.`
    }
  } else if (['reminder', 'reminders', 'daily'].includes(primary)) {
    const enabled = parseBooleanSetting(secondary)
    if (enabled !== null) {
      update = { daily_reminder_enabled: enabled, is_active: true }
      successMessage = `Balance reminders are now ${enabled ? 'on' : 'off'}.`
    }
  } else if (['time', 'at'].includes(primary)) {
    const time = parseReminderTime(parts.slice(1).join(' '))
    if (time) {
      update = { reminder_hour: time.hour, reminder_minute: time.minute, daily_reminder_enabled: true, is_active: true }
      successMessage = `Balance reminders will run at ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}.`
    }
  } else if (['every', 'interval', 'frequency', 'duration'].includes(primary)) {
    const interval = parseReminderInterval(parts.slice(1).join(' '))
    if (interval) {
      update = { reminder_interval_days: interval, daily_reminder_enabled: true, is_active: true }
      successMessage = interval === 1 ? 'Balance reminders will run daily.' : `Balance reminders will run every ${interval} days.`
    }
  } else if (['tz', 'timezone'].includes(primary)) {
    const timezone = parts.slice(1).join(' ')
    if (timezone) {
      update = { reminder_timezone: timezone, daily_reminder_enabled: true, is_active: true }
      successMessage = `Reminder timezone set to ${timezone}.`
    }
  }

  if (!update) {
    await sendTelegramMessage({
      botToken,
      chatId: chat.id,
      text: [
        'I did not understand that alert command.',
        '',
        'Try:',
        '/alerts on',
        '/alerts off',
        '/alerts expense on',
        '/alerts payment off',
        '/alerts reminders on',
        '/alerts time 09:30',
        '/alerts every 2 days',
        '/alerts status',
      ].join('\n'),
    })
    return { ok: false, error: 'Invalid alerts command' }
  }

  const updated = await updateConnectionSettings({ chatId: chat.id, update })
  await sendTelegramMessage({
    botToken,
    chatId: chat.id,
    text: `${successMessage}\n\n${formatTelegramSettings(updated)}`,
  })

  return { ok: true, action: 'alerts_update' }
}

async function markOutboxRows(ids, update) {
  if (!Array.isArray(ids) || ids.length === 0) return

  await adminSupabase.from('telegram_outbox').update(update).in('id', ids)
}

async function markBatchFailed(rows, errorMessage, { retry = true } = {}) {
  for (const row of rows) {
    const attempts = Number(row.attempts || 0) + 1
    const shouldFail = !retry || attempts >= 5

    await adminSupabase
      .from('telegram_outbox')
      .update({
        status: shouldFail ? 'failed' : 'pending',
        attempts,
        error_message: errorMessage,
        available_at: shouldFail ? new Date().toISOString() : toPendingRetryTimestamp(),
      })
      .eq('id', row.id)
  }
}

async function deactivateConnectionsForChat(telegramChatId) {
  if (!telegramChatId) return

  const { data: affectedRows, error: fetchError } = await adminSupabase
    .from('telegram_connections')
    .select('group_id')
    .eq('telegram_chat_id', telegramChatId)

  if (fetchError) throw fetchError

  const groupIds = (affectedRows || []).map((row) => row.group_id)
  if (groupIds.length === 0) return

  const { error: deactivateError } = await adminSupabase
    .from('telegram_connections')
    .update({ is_active: false })
    .eq('telegram_chat_id', telegramChatId)

  if (deactivateError) throw deactivateError

  const { error: groupUpdateError } = await adminSupabase
    .from('groups')
    .update({ telegram_connected: false, telegram_group_name: null })
    .in('id', groupIds)

  if (groupUpdateError) throw groupUpdateError
}

export async function handleTelegramWebhook({ botToken, update }) {
  if (!update || typeof update !== 'object') return { ok: true, ignored: true }

  const message = update.message || update.edited_message
  if (!message) return { ok: true, ignored: true }

  const chat = message.chat || {}
  if (chat.type !== 'group' && chat.type !== 'supergroup') {
    return { ok: true, ignored: true }
  }

  const text = String(message.text || '').trim()
  const alertsResult = await handleAlertsCommand({ botToken, chat, text })
  if (alertsResult) return alertsResult

  const match = text.match(/^\/link(?:@\w+)?\s+([A-Za-z0-9_-]+)$/i)
  if (!match) return { ok: true, ignored: true }

  const token = String(match[1] || '').trim().toUpperCase()
  if (!token) return { ok: false, error: 'Invalid token' }

  const nowIso = new Date().toISOString()
  const { data: linkToken, error: tokenError } = await adminSupabase
    .from('telegram_link_tokens')
    .select('id,group_id,created_by,used_at,expires_at')
    .eq('token', token)
    .maybeSingle()

  if (tokenError) throw tokenError

  if (!linkToken || linkToken.used_at || new Date(linkToken.expires_at).getTime() < Date.now()) {
    await sendTelegramMessage({
      botToken,
      chatId: chat.id,
      text: '❌ Invalid or expired link code. Generate a new one in the app.',
    })
    return { ok: false, error: 'Invalid or expired token' }
  }

  const connectionPayload = {
    group_id: linkToken.group_id,
    telegram_chat_id: chat.id,
    telegram_group_name: chat.title || 'Telegram group',
    linked_by: linkToken.created_by,
    is_active: true,
    expense_alerts_enabled: true,
    payment_alerts_enabled: true,
    daily_reminder_enabled: true,
    reminder_hour: 0,
    reminder_minute: 0,
    reminder_timezone: 'Asia/Singapore',
    reminder_interval_days: 1,
  }

  let connectionResponse = await adminSupabase.from('telegram_connections').upsert(connectionPayload, { onConflict: 'group_id' })

  if (isMissingColumnError(connectionResponse.error)) {
    const legacyPayload = { ...connectionPayload }
    delete legacyPayload.reminder_interval_days
    connectionResponse = await adminSupabase.from('telegram_connections').upsert(legacyPayload, { onConflict: 'group_id' })
  }

  const { error: connectionError } = connectionResponse

  if (connectionError) throw connectionError

  const { error: tokenUpdateError } = await adminSupabase
    .from('telegram_link_tokens')
    .update({ used_at: nowIso, used_chat_id: chat.id, used_chat_title: chat.title || null })
    .eq('id', linkToken.id)

  if (tokenUpdateError) throw tokenUpdateError

  const { error: groupUpdateError } = await adminSupabase
    .from('groups')
    .update({ telegram_connected: true, telegram_group_name: chat.title || 'Telegram group' })
    .eq('id', linkToken.group_id)

  if (groupUpdateError) throw groupUpdateError

  await sendTelegramMessage({
    botToken,
    chatId: chat.id,
    text: [
      'Kaki Split connected. We send unsettled-balance reminders once per day by default.',
      '',
      'Manage alerts here with:',
      '/alerts on',
      '/alerts off',
      '/alerts time 09:30',
      '/alerts every 2 days',
      '/alerts status',
    ].join('\n'),
  })

  return { ok: true, linkedGroupId: linkToken.group_id }
}

export async function unlinkGroupTelegramConnection({ groupId }) {
  if (!groupId) return

  const { error: connectionError } = await adminSupabase
    .from('telegram_connections')
    .update({ is_active: false })
    .eq('group_id', groupId)

  if (connectionError) throw connectionError

  const { error: groupError } = await adminSupabase
    .from('groups')
    .update({ telegram_connected: false, telegram_group_name: null })
    .eq('id', groupId)

  if (groupError) throw groupError
}

export async function processTelegramOutbox({ botToken }) {
  const { data: rows, error } = await adminSupabase
    .from('telegram_outbox')
    .select('id,group_id,event_type,payload,attempts,created_at')
    .eq('status', 'pending')
    .lte('available_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) throw error
  if (!rows || rows.length === 0) return { processed: 0, sent: 0, failed: 0 }

  const groupIds = [...new Set(rows.map((row) => row.group_id))]
  const { data: connections, error: connectionError } = await adminSupabase
    .from('telegram_connections')
    .select('group_id,telegram_chat_id,is_active,expense_alerts_enabled,payment_alerts_enabled,daily_reminder_enabled')
    .in('group_id', groupIds)

  if (connectionError) throw connectionError

  const connectionByGroup = new Map((connections || []).map((conn) => [conn.group_id, conn]))
  const rowsByGroup = new Map()

  function messageForEvent(row) {
    const payload = row.payload || {}

    if (row.event_type === 'daily_reminder') {
      return payload.message || 'Daily reminder: unsettled balances remain.'
    }

    if (row.event_type === 'expense_added') {
      const description = String(payload.description || 'Expense added').trim()
      const amount = round2(payload.amount || 0).toFixed(2)
      return `${description}\nAmount: ${amount}`
    }

    if (row.event_type === 'payment_recorded') {
      const amount = round2(payload.amount || 0).toFixed(2)
      return `Payment recorded\nAmount: ${amount}`
    }

    return null
  }

  for (const row of rows) {
    if (!rowsByGroup.has(row.group_id)) {
      rowsByGroup.set(row.group_id, [])
    }
    rowsByGroup.get(row.group_id).push(row)
  }

  let sent = 0
  let failed = 0

  for (const [groupId, groupRows] of rowsByGroup.entries()) {
    const connection = connectionByGroup.get(groupId)
    const sendableRows = []
    const skippedRows = []

    for (const row of groupRows) {
      const disabledBySetting =
        !connection?.is_active ||
        (row.event_type === 'expense_added' && !connection?.expense_alerts_enabled) ||
        (row.event_type === 'payment_recorded' && !connection?.payment_alerts_enabled) ||
        (row.event_type === 'daily_reminder' && !connection?.daily_reminder_enabled)

      if (disabledBySetting) {
        skippedRows.push(row)
      } else {
        sendableRows.push(row)
      }
    }

    if (skippedRows.length > 0) {
      await markOutboxRows(
        skippedRows.map((row) => row.id),
        { status: 'sent', sent_at: new Date().toISOString(), error_message: null }
      )
    }

    if (!connection?.telegram_chat_id) {
      if (sendableRows.length > 0) {
        await markBatchFailed(sendableRows, 'Missing Telegram chat', { retry: false })
        failed += sendableRows.length
      }
      continue
    }

    for (const row of sendableRows) {
      const message = messageForEvent(row)

      if (!message) {
        await markBatchFailed([row], 'Unsupported event type', { retry: false })
        failed += 1
        continue
      }

      const sendResult = await sendTelegramMessage({
        botToken,
        chatId: connection.telegram_chat_id,
        text: message,
      })

      if (sendResult.ok) {
        await adminSupabase
          .from('telegram_outbox')
          .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
          .eq('id', row.id)
        sent += 1
      } else {
        if (shouldDisableConnection(sendResult)) {
          await deactivateConnectionsForChat(connection.telegram_chat_id)
        }

        const attempts = Number(row.attempts || 0) + 1
        const shouldFail = attempts >= 5

        await adminSupabase
          .from('telegram_outbox')
          .update({
            status: shouldFail ? 'failed' : 'pending',
            attempts,
            error_message: sendResult.result?.description || `HTTP ${sendResult.status}`,
            available_at: shouldFail ? new Date().toISOString() : toPendingRetryTimestamp(),
          })
          .eq('id', row.id)
        failed += 1
      }
    }
  }

  return { processed: rows.length, sent, failed }
}

function computeNetBalances({ memberIds, expenses, splitsByExpenseId, payments }) {
  const net = new Map(memberIds.map((id) => [id, 0]))

  for (const expense of expenses) {
    const amount = Number(expense.amount || 0)
    net.set(expense.paid_by, round2((net.get(expense.paid_by) || 0) + amount))

    const splits = splitsByExpenseId.get(expense.id) || []
    const uniqueSplitsByUser = new Map()

    for (const split of splits) {
      if (!uniqueSplitsByUser.has(split.user_id)) {
        uniqueSplitsByUser.set(split.user_id, Number(split.amount || 0))
      }
    }

    for (const [splitUserId, share] of uniqueSplitsByUser.entries()) {
      net.set(splitUserId, round2((net.get(splitUserId) || 0) - share))
    }
  }

  for (const payment of payments) {
    const amount = Number(payment.amount || 0)
    net.set(payment.from_user_id, round2((net.get(payment.from_user_id) || 0) + amount))
    net.set(payment.to_user_id, round2((net.get(payment.to_user_id) || 0) - amount))
  }

  return net
}

function settleNetBalances(net) {
  const creditors = []
  const debtors = []

  for (const [userId, amount] of net.entries()) {
    if (amount > 0.009) creditors.push({ userId, amount: round2(amount) })
    if (amount < -0.009) debtors.push({ userId, amount: round2(Math.abs(amount)) })
  }

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const flows = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = round2(Math.min(debtor.amount, creditor.amount))

    if (amount > 0) {
      flows.push({ from: debtor.userId, to: creditor.userId, amount })
    }

    debtor.amount = round2(debtor.amount - amount)
    creditor.amount = round2(creditor.amount - amount)

    if (debtor.amount <= 0.009) i += 1
    if (creditor.amount <= 0.009) j += 1
  }

  return flows
}

function buildPairExpenseContext(expenses, splitsByExpenseId) {
  const contextByPair = new Map()

  for (const expense of expenses || []) {
    const description = String(expense.description || '').trim()
    if (!description) continue

    const payerId = expense.paid_by
    if (!payerId) continue

    const splits = splitsByExpenseId.get(expense.id) || []
    for (const split of splits) {
      const debtorId = split.user_id
      const share = Number(split.amount || 0)
      if (!debtorId || debtorId === payerId || share <= 0) continue

      const pairKey = `${debtorId}:${payerId}`
      if (!contextByPair.has(pairKey)) {
        contextByPair.set(pairKey, new Map())
      }

      const descriptionTotals = contextByPair.get(pairKey)
      descriptionTotals.set(description, round2((descriptionTotals.get(description) || 0) + share))
    }
  }

  return contextByPair
}

function formatPairExpenseContext(contextByPair, fromUserId, toUserId) {
  const descriptionTotals = contextByPair.get(`${fromUserId}:${toUserId}`)
  if (!descriptionTotals || descriptionTotals.size === 0) return ''

  const ranked = [...descriptionTotals.entries()].sort((a, b) => b[1] - a[1])
  const topDescriptions = ranked.slice(0, 2).map(([description]) => description)
  const moreCount = Math.max(0, ranked.length - topDescriptions.length)

  if (topDescriptions.length === 0) return ''
  if (moreCount > 0) {
    return `${topDescriptions.join(' + ')} +${moreCount} more`
  }

  return topDescriptions.join(' + ')
}

export async function queueDailyTelegramReminders({ now = new Date() } = {}) {
  let rowsResponse = await adminSupabase
    .from('telegram_connections')
    .select('group_id,is_active,daily_reminder_enabled,reminder_hour,reminder_minute,reminder_timezone,reminder_interval_days,last_daily_reminder_date')
    .eq('is_active', true)
    .eq('daily_reminder_enabled', true)

  if (isMissingColumnError(rowsResponse.error)) {
    rowsResponse = await adminSupabase
      .from('telegram_connections')
      .select('group_id,is_active,daily_reminder_enabled,reminder_hour,reminder_minute,reminder_timezone,last_daily_reminder_date')
      .eq('is_active', true)
      .eq('daily_reminder_enabled', true)
  }

  const { data: rows, error } = rowsResponse
  if (error) throw error
  if (!rows || rows.length === 0) return { scanned: 0, queued: 0 }

  let queued = 0

  for (const row of rows) {
      const hour = Number(row.reminder_hour ?? 0)
      const minute = Number(row.reminder_minute ?? 0)
      const timezone = row.reminder_timezone || 'Asia/Singapore'
      const localNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))

      const dateKey = toDateInTimezone(now, timezone)
      if (row.last_daily_reminder_date === dateKey) continue

      const intervalDays = Math.max(1, Math.min(30, Number(row.reminder_interval_days || 1)))
      if (row.last_daily_reminder_date && intervalDays > 1) {
        const elapsedMs = new Date(`${dateKey}T00:00:00Z`).getTime() - new Date(`${row.last_daily_reminder_date}T00:00:00Z`).getTime()
        const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000))
        if (elapsedDays < intervalDays) continue
      }

      const scheduledMinuteOfDay = hour * 60 + minute
      const nowMinuteOfDay = localNow.getHours() * 60 + localNow.getMinutes()
      if (nowMinuteOfDay < scheduledMinuteOfDay) continue


      const { data: group, error: groupError } = await adminSupabase
        .from('groups')
        .select('id,name,invite_code')
        .eq('id', row.group_id)
        .maybeSingle()
    if (groupError) throw groupError
    if (!group) continue

    const [{ data: members, error: membersError }, { data: expenses, error: expensesError }, { data: payments, error: paymentsError }] = await Promise.all([
        adminSupabase.from('group_members').select('user_id').eq('group_id', row.group_id),
        adminSupabase.from('expenses').select('id,amount,paid_by,description').eq('group_id', row.group_id),
        adminSupabase.from('payments').select('from_user_id,to_user_id,amount').eq('group_id', row.group_id).is('voided_at', null),
    ])

    if (membersError) throw membersError
    if (expensesError) throw expensesError
    if (paymentsError) throw paymentsError

    const expenseIds = (expenses || []).map((expense) => expense.id)
    let splits = []

    if (expenseIds.length > 0) {
      const { data: splitRows, error: splitError } = await adminSupabase
        .from('expense_splits')
        .select('expense_id,user_id,amount')
        .in('expense_id', expenseIds)

      if (splitError) throw splitError
      splits = splitRows || []
    }

    const splitsByExpenseId = new Map()
    for (const split of splits) {
      const list = splitsByExpenseId.get(split.expense_id)
      if (list) {
        list.push(split)
      } else {
        splitsByExpenseId.set(split.expense_id, [split])
      }
    }

        const memberIds = (members || []).map((member) => member.user_id)
        const net = computeNetBalances({ memberIds, expenses: expenses || [], splitsByExpenseId, payments: payments || [] })
        const smartBalances = settleNetBalances(net)
        const pairExpenseContext = buildPairExpenseContext(expenses || [], splitsByExpenseId)

        if (smartBalances.length > 0) {
          const userIds = [...new Set(smartBalances.flatMap((item) => [item.from, item.to]))]
          const { data: profiles, error: profileError } = await adminSupabase
            .from('profiles')
            .select('id,display_name,email')
            .in('id', userIds)

          if (profileError) throw profileError

          const profileById = new Map(
            (profiles || []).map((profile) => [profile.id, profile.display_name || String(profile.email || '').split('@')[0] || 'Member'])
          )

          const lines = smartBalances.slice(0, 5).map((item) => {
            const fromName = profileById.get(item.from) || 'Member'
            const toName = profileById.get(item.to) || 'Member'
            const context = formatPairExpenseContext(pairExpenseContext, item.from, item.to)
            return context
              ? `• ${fromName} owes ${toName} ${round2(item.amount).toFixed(2)} (${context})`
              : `• ${fromName} owes ${toName} ${round2(item.amount).toFixed(2)}`
          })

          if (smartBalances.length > 5) {
            lines.push(`• +${smartBalances.length - 5} more unsettled balance${smartBalances.length - 5 > 1 ? 's' : ''}`)
          }

            const appUrl = getAppUrl()
            const invitePath = group.invite_code ? `/join/${group.invite_code}` : '/login'
            const messageLines = ['Unsettled balances:', ...lines, '', `Settle up in app: ${appUrl}${invitePath}`]


        const { error: outboxError } = await adminSupabase.from('telegram_outbox').insert({
          group_id: row.group_id,
          event_type: 'daily_reminder',
          payload: {
            message: messageLines.join('\n'),
            generated_at: now.toISOString(),
          },
          status: 'pending',
        })

        if (outboxError) throw outboxError
        queued += 1
      }


    const { error: updateError } = await adminSupabase
      .from('telegram_connections')
      .update({ last_daily_reminder_date: dateKey })
      .eq('group_id', row.group_id)

    if (updateError) throw updateError
  }

  return { scanned: rows.length, queued }
}
