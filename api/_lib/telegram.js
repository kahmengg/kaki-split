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

export async function handleTelegramWebhook({ botToken, update }) {
  if (!update || typeof update !== 'object') return { ok: true, ignored: true }

  const message = update.message || update.edited_message
  if (!message) return { ok: true, ignored: true }

  const chat = message.chat || {}
  if (chat.type !== 'group' && chat.type !== 'supergroup') {
    return { ok: true, ignored: true }
  }

  const text = String(message.text || '').trim()
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

  const { error: connectionError } = await adminSupabase.from('telegram_connections').upsert(
    {
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
    },
    { onConflict: 'group_id' }
  )

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
    text: '✅ KakiSplit connected. Daily reminders run at 12:00 AM.',
  })

  return { ok: true, linkedGroupId: linkToken.group_id }
}

export async function processTelegramOutbox({ botToken }) {
  const { data: rows, error } = await adminSupabase
    .from('telegram_outbox')
    .select('id,group_id,event_type,payload,attempts')
    .eq('status', 'pending')
    .lte('available_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(25)

  if (error) throw error
  if (!rows || rows.length === 0) return { processed: 0, sent: 0, failed: 0 }

  const groupIds = [...new Set(rows.map((row) => row.group_id))]
  const { data: connections, error: connectionError } = await adminSupabase
    .from('telegram_connections')
    .select('group_id,telegram_chat_id,is_active,expense_alerts_enabled,payment_alerts_enabled,daily_reminder_enabled')
    .in('group_id', groupIds)

  if (connectionError) throw connectionError

  const connectionByGroup = new Map((connections || []).map((conn) => [conn.group_id, conn]))

  const messageForEvent = (row) => {
    const payload = row.payload || {}
    if (row.event_type === 'expense_added') {
      return `🧾 New expense\n${payload.description || 'Expense'} · ${round2(payload.amount || 0).toFixed(2)}`
    }
    if (row.event_type === 'payment_recorded') {
      return `💸 Payment recorded\nAmount: ${round2(payload.amount || 0).toFixed(2)}`
    }
    if (row.event_type === 'daily_reminder') {
      return payload.message || '⏰ Daily reminder: unsettled balances remain.'
    }
    return null
  }

  let sent = 0
  let failed = 0

  for (const row of rows) {
    const connection = connectionByGroup.get(row.group_id)
    const skipBySetting =
      !connection?.is_active ||
      (row.event_type === 'expense_added' && !connection?.expense_alerts_enabled) ||
      (row.event_type === 'payment_recorded' && !connection?.payment_alerts_enabled) ||
      (row.event_type === 'daily_reminder' && !connection?.daily_reminder_enabled)

    if (skipBySetting) {
      await adminSupabase.from('telegram_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null }).eq('id', row.id)
      continue
    }

    const text = messageForEvent(row)
    if (!text || !connection?.telegram_chat_id) {
      await adminSupabase
        .from('telegram_outbox')
        .update({ status: 'failed', attempts: Number(row.attempts || 0) + 1, error_message: 'Missing chat or unsupported event' })
        .eq('id', row.id)
      failed += 1
      continue
    }

    const sendResult = await sendTelegramMessage({ botToken, chatId: connection.telegram_chat_id, text })
    if (sendResult.ok) {
      await adminSupabase.from('telegram_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null }).eq('id', row.id)
      sent += 1
    } else {
      const attempts = Number(row.attempts || 0) + 1
      const shouldFail = attempts >= 5
      await adminSupabase
        .from('telegram_outbox')
        .update({
          status: shouldFail ? 'failed' : 'pending',
          attempts,
          error_message: sendResult.result?.description || `HTTP ${sendResult.status}`,
          available_at: shouldFail ? new Date().toISOString() : new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        })
        .eq('id', row.id)
      failed += 1
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

export async function queueDailyTelegramReminders({ now = new Date() } = {}) {
  const { data: rows, error } = await adminSupabase
    .from('telegram_connections')
    .select('group_id,is_active,daily_reminder_enabled,reminder_hour,reminder_minute,reminder_timezone,last_daily_reminder_date')
    .eq('is_active', true)
    .eq('daily_reminder_enabled', true)

  if (error) throw error
  if (!rows || rows.length === 0) return { scanned: 0, queued: 0 }

  let queued = 0

  for (const row of rows) {
    const hour = Number(row.reminder_hour ?? 0)
    const minute = Number(row.reminder_minute ?? 0)
    const timezone = row.reminder_timezone || 'Asia/Singapore'
    const localNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))

    if (localNow.getHours() !== hour || localNow.getMinutes() !== minute) continue

    const dateKey = toDateInTimezone(now, timezone)
    if (row.last_daily_reminder_date === dateKey) continue

    const { data: group, error: groupError } = await adminSupabase.from('groups').select('id,name').eq('id', row.group_id).maybeSingle()
    if (groupError) throw groupError
    if (!group) continue

    const [{ data: members, error: membersError }, { data: expenses, error: expensesError }, { data: payments, error: paymentsError }] = await Promise.all([
      adminSupabase.from('group_members').select('user_id').eq('group_id', row.group_id),
      adminSupabase.from('expenses').select('id,amount,paid_by').eq('group_id', row.group_id),
      adminSupabase.from('payments').select('from_user_id,to_user_id,amount').eq('group_id', row.group_id),
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
        return `• ${fromName} owes ${toName} ${round2(item.amount).toFixed(2)}`
      })

      const message = [
        `⏰ Daily reminder for ${group.name}`,
        `${smartBalances.length} unsettled balance${smartBalances.length > 1 ? 's' : ''} remaining:`,
        ...lines,
      ].join('\n')

      const { error: outboxError } = await adminSupabase.from('telegram_outbox').insert({
        group_id: row.group_id,
        event_type: 'daily_reminder',
        payload: {
          message,
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
