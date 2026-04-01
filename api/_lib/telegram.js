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

function toOutboxMessageRow(row) {
  const payload = row.payload || {}

  if (row.event_type === 'expense_added') {
    return {
      type: 'expense',
      text: `• 🧾 ${payload.description || 'Expense'} · ${round2(payload.amount || 0).toFixed(2)}`,
      amount: round2(payload.amount || 0),
      createdAt: row.created_at,
    }
  }

  if (row.event_type === 'payment_recorded') {
    return {
      type: 'payment',
      text: `• 💸 Payment recorded · ${round2(payload.amount || 0).toFixed(2)}`,
      amount: round2(payload.amount || 0),
      createdAt: row.created_at,
    }
  }

  return null
}

function buildDigestMessage(rows) {
  const normalizedRows = rows
    .map(toOutboxMessageRow)
    .filter(Boolean)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  if (normalizedRows.length === 0) return null

  const expenseRows = normalizedRows.filter((row) => row.type === 'expense')
  const paymentRows = normalizedRows.filter((row) => row.type === 'payment')
  const expenseTotal = round2(expenseRows.reduce((sum, row) => sum + row.amount, 0))
  const paymentTotal = round2(paymentRows.reduce((sum, row) => sum + row.amount, 0))

  const lines = ['📬 KakiSplit updates']

  if (expenseRows.length > 0) {
    lines.push(`🧾 ${expenseRows.length} expense${expenseRows.length > 1 ? 's' : ''} added (${expenseTotal.toFixed(2)} total)`)
  }

  if (paymentRows.length > 0) {
    lines.push(`💸 ${paymentRows.length} payment${paymentRows.length > 1 ? 's' : ''} recorded (${paymentTotal.toFixed(2)} total)`)
  }

  lines.push('')
  lines.push('Latest activity:')

  const previewRows = normalizedRows.slice(-5)
  for (const row of previewRows) {
    lines.push(row.text)
  }

  if (normalizedRows.length > previewRows.length) {
    lines.push(`• +${normalizedRows.length - previewRows.length} more update${normalizedRows.length - previewRows.length > 1 ? 's' : ''}`)
  }

  return lines.join('\n')
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
    text: '✅ KakiSplit connected. We send a daily reminder with an updates summary once per day.',
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
    .eq('event_type', 'daily_reminder')
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

      const skippedRows = []
      const reminderRows = []

      for (const row of groupRows) {
        const skipBySetting = !connection?.is_active || (row.event_type === 'daily_reminder' && !connection?.daily_reminder_enabled)

        if (skipBySetting) {
          skippedRows.push(row)
          continue
        }

        if (row.event_type === 'daily_reminder') {
          reminderRows.push(row)
        } else {
          skippedRows.push(row)
        }
      }

      if (skippedRows.length > 0) {
        await markOutboxRows(
          skippedRows.map((row) => row.id),
          { status: 'sent', sent_at: new Date().toISOString(), error_message: null }
        )
      }

      if (!connection?.telegram_chat_id) {
        if (reminderRows.length > 0) {
          await markBatchFailed(reminderRows, 'Missing chat or unsupported event', { retry: false })
          failed += reminderRows.length
        }
        continue
      }

      for (const row of reminderRows) {

      const message = row.payload?.message || '⏰ Daily reminder: unsettled balances remain.'
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

      const dateKey = toDateInTimezone(now, timezone)
      if (row.last_daily_reminder_date === dateKey) continue

      const scheduledMinuteOfDay = hour * 60 + minute
      const nowMinuteOfDay = localNow.getHours() * 60 + localNow.getMinutes()
      if (nowMinuteOfDay < scheduledMinuteOfDay) continue


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

      const { data: pendingActivityRows, error: pendingActivityError } = await adminSupabase
        .from('telegram_outbox')
        .select('id,event_type,payload,created_at')
        .eq('group_id', row.group_id)
        .eq('status', 'pending')
        .in('event_type', ['expense_added', 'payment_recorded'])
        .order('created_at', { ascending: true })
        .limit(100)

      if (pendingActivityError) throw pendingActivityError

      const activityDigestMessage = buildDigestMessage(pendingActivityRows || [])
      if ((pendingActivityRows || []).length > 0) {
        const { error: markActivityRowsSentError } = await adminSupabase
          .from('telegram_outbox')
          .update({ status: 'sent', sent_at: now.toISOString(), error_message: null })
          .in(
            'id',
            (pendingActivityRows || []).map((activityRow) => activityRow.id)
          )

        if (markActivityRowsSentError) throw markActivityRowsSentError
      }

      if (smartBalances.length > 0 || activityDigestMessage) {
        let lines = []

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

          lines = smartBalances.slice(0, 5).map((item) => {
            const fromName = profileById.get(item.from) || 'Member'
            const toName = profileById.get(item.to) || 'Member'
            return `• ${fromName} owes ${toName} ${round2(item.amount).toFixed(2)}`
          })
        }

        const messageLines = [`⏰ Daily reminder for ${group.name}`]

        if (smartBalances.length > 0) {
          messageLines.push(`${smartBalances.length} unsettled balance${smartBalances.length > 1 ? 's' : ''} remaining:`)
          messageLines.push(...lines)
        } else {
          messageLines.push('No unsettled balances right now.')
        }

        if (activityDigestMessage) {
          messageLines.push('')
          messageLines.push(activityDigestMessage)
        }

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
