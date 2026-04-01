import { supabase } from './supabase'
import { computeNetBalances, settleNetBalances } from './balances'

const PENDING_INVITE_KEY = 'kakisplit:pendingInviteCode'

const PROFILE_COLUMNS = 'id,display_name,email,avatar_url,avatar_color,paynow_number,grabpay_handle,paylah_handle'
const TELEGRAM_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const TELEGRAM_LINK_TOKEN_LENGTH = 6
const TELEGRAM_LINK_TOKEN_TTL_MINUTES = 30
const TELEGRAM_BOT_USERNAME = 'kaki_split'

const AVATAR_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#14b8a6']

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function colorFromId(id) {
  if (!id) return AVATAR_COLORS[0]
  const hash = Array.from(id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function toAppUser(profile) {
  if (!profile) return null
  const displayName = profile.display_name || profile.email?.split('@')[0] || 'User'

  return {
    ...profile,
    name: displayName,
    display_name: displayName,
    avatar_color: profile.avatar_color || colorFromId(profile.id),
  }
}

function generateInviteCode(length = 8) {
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += TELEGRAM_TOKEN_ALPHABET[Math.floor(Math.random() * TELEGRAM_TOKEN_ALPHABET.length)]
  }
  return code
}

function normalizeTelegramToken(token) {
  return String(token || '').trim().toUpperCase()
}

function normalizeEventPayload(payload) {
  if (!payload || typeof payload !== 'object') return {}
  return payload
}

function isAuthLockError(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('auth token was released because another request stole it') || message.includes('lockmanager')
}

async function withAuthLockRetry(operation) {
  try {
    return await operation()
  } catch (error) {
    if (!isAuthLockError(error)) throw error
    await new Promise((resolve) => window.setTimeout(resolve, 250))
    return operation()
  }
}

function formatTelegramCode(code) {
  const normalized = normalizeTelegramToken(code)
  if (!normalized) return ''
  return normalized.split('').join(' ')
}

function toTelegramRlsError(error) {
  if (!error) return null
  const code = String(error.code || '')
  const message = String(error.message || '')
  const details = String(error.details || '')
  const hint = String(error.hint || '')
  const combined = `${message} ${details} ${hint}`.toLowerCase()

  if (code === '42501' || combined.includes('row-level security') || combined.includes('rls')) {
    return new Error(
      'Telegram setup is blocked by Supabase RLS policies. Run the Telegram policy SQL in Supabase SQL Editor, then try generating the link code again.'
    )
  }

  return null
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

async function enqueueTelegramNotification({ groupId, eventType, payload }) {
  if (!groupId || !eventType) return

  const { error } = await supabase.from('telegram_outbox').insert({
    group_id: groupId,
    event_type: eventType,
    payload: normalizeEventPayload(payload),
    status: 'pending',
  })

  if (!error) return

  const code = String(error.code || '')
  if (code === '42P01' || code === '42501') {
    return
  }

  throw error
}

function toCents(value) {
  return Math.round(Number(value || 0) * 100)
}

function splitEvenly(totalAmount, peopleCount) {
  const totalCents = toCents(totalAmount)
  const base = Math.floor(totalCents / peopleCount)
  const remainder = totalCents - base * peopleCount

  return Array.from({ length: peopleCount }, (_, index) => {
    const cents = base + (index < remainder ? 1 : 0)
    return cents / 100
  })
}

function splitByWeights(totalAmount, weights) {
  const totalCents = toCents(totalAmount)
  const totalWeight = weights.reduce((sum, weight) => sum + Number(weight || 0), 0)

  if (totalWeight <= 0) {
    throw new Error('Split weights must add up to more than 0')
  }

  const rawCents = weights.map((weight) => (totalCents * Number(weight || 0)) / totalWeight)
  const baseCents = rawCents.map((value) => Math.floor(value))
  let remainder = totalCents - baseCents.reduce((sum, value) => sum + value, 0)

  const rankedIndices = rawCents
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)

  let cursor = 0
  while (remainder > 0 && rankedIndices.length > 0) {
    baseCents[rankedIndices[cursor % rankedIndices.length].index] += 1
    remainder -= 1
    cursor += 1
  }

  return baseCents.map((value) => value / 100)
}

function groupBy(list, keySelector) {
  const map = new Map()
  for (const item of list) {
    const key = keySelector(item)
    const current = map.get(key)
    if (current) {
      current.push(item)
    } else {
      map.set(key, [item])
    }
  }
  return map
}

export async function fetchGroupMembers(groupId) {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .maybeSingle()

  if (groupError) throw groupError
  if (!group) return { group: null, members: [], usersById: {} }

  const { data: memberRows, error: membersError } = await supabase
    .from('group_members')
    .select(`group_id,user_id,profiles:user_id(${PROFILE_COLUMNS})`)
    .eq('group_id', groupId)

  if (membersError) throw membersError

  const members = (memberRows || [])
    .map((row) => toAppUser(row.profiles))
    .filter(Boolean)

  const usersById = members.reduce((acc, member) => {
    acc[member.id] = member
    return acc
  }, {})

  return { group, members, usersById }
}

export async function fetchDashboardData(userId) {
  const { data: membershipRows, error: membershipError } = await supabase
    .from('group_members')
    .select('group_id,groups:group_id(id,name,created_by,invite_code,base_currency,telegram_connected,telegram_group_name,created_at)')
    .eq('user_id', userId)

  if (membershipError) throw membershipError

  const groups = (membershipRows || []).map((row) => row.groups).filter(Boolean)
  if (groups.length === 0) {
    return { groups: [], usersById: {} }
  }

  const groupIds = groups.map((group) => group.id)

  const [{ data: allMemberRows, error: allMembersError }, { data: expenses, error: expensesError }, { data: payments, error: paymentsError }] =
    await Promise.all([
      supabase
        .from('group_members')
        .select(`group_id,user_id,profiles:user_id(${PROFILE_COLUMNS})`)
        .in('group_id', groupIds),
      supabase
        .from('expenses')
        .select('id,group_id,amount,created_at,paid_by')
        .in('group_id', groupIds),
      supabase
        .from('payments')
        .select('id,group_id,from_user_id,to_user_id,amount,created_at')
        .in('group_id', groupIds),
    ])

  if (allMembersError) throw allMembersError
  if (expensesError) throw expensesError
  if (paymentsError) throw paymentsError

  const expenseIds = (expenses || []).map((expense) => expense.id)
  let splits = []

  if (expenseIds.length > 0) {
    const { data: splitRows, error: splitError } = await supabase
      .from('expense_splits')
      .select('expense_id,user_id,amount,is_settled')
      .in('expense_id', expenseIds)

    if (splitError) throw splitError
    splits = splitRows || []
  }

  const membersByGroup = groupBy(allMemberRows || [], (row) => row.group_id)
  const expensesByGroup = groupBy(expenses || [], (row) => row.group_id)
  const paymentsByGroup = groupBy(payments || [], (row) => row.group_id)
  const splitsByExpenseId = groupBy(splits || [], (row) => row.expense_id)

  const usersById = {}
  for (const row of allMemberRows || []) {
    const appUser = toAppUser(row.profiles)
    if (appUser) usersById[appUser.id] = appUser
  }

  const hydratedGroups = groups.map((group) => {
    const groupMembers = membersByGroup.get(group.id) || []
    const memberIds = groupMembers.map((member) => member.user_id)
    const groupExpenses = expensesByGroup.get(group.id) || []
    const groupPayments = paymentsByGroup.get(group.id) || []

    const net = computeNetBalances({
      memberIds,
      expenses: groupExpenses,
      splitsByExpenseId,
      payments: groupPayments,
    })

    const totalSpent = groupExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)

    const lastDates = [
      group.created_at,
      ...groupExpenses.map((expense) => expense.created_at),
      ...groupPayments.map((payment) => payment.created_at),
    ].filter(Boolean)

    const lastActivity = lastDates.sort((a, b) => new Date(b) - new Date(a))[0] || group.created_at

    return {
      ...group,
      member_ids: memberIds,
      my_balance: round2(net.get(userId) || 0),
      total_spent: round2(totalSpent),
      last_activity: lastActivity,
    }
  })

  hydratedGroups.sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity))

  return { groups: hydratedGroups, usersById }
}

export async function createGroup({ userId, name, baseCurrency = 'SGD' }) {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Group name is required')

  const inviteCode = generateInviteCode()

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name: trimmedName,
      created_by: userId,
      base_currency: baseCurrency,
      invite_code: inviteCode,
    })
    .select('*')
    .maybeSingle()

  if (groupError) throw groupError
  if (!group) {
    throw new Error('Unable to create group. Check Supabase RLS policies for groups/group_members.')
  }

  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: userId,
    role: 'owner',
  })

  if (memberError) throw memberError

  return group
}

export async function joinGroupByInviteCode({ inviteCode, userId }) {
  const normalizedCode = String(inviteCode || '').trim().toUpperCase()
  if (!normalizedCode) throw new Error('Invite code is missing')
  if (!userId) throw new Error('Please sign in to join this group')

  const {
    data: { session },
    error: sessionError,
  } = await withAuthLockRetry(() => supabase.auth.getSession())

  if (sessionError) throw sessionError
  if (!session?.access_token) throw new Error('Please sign in again to join this group')

  const response = await fetch('/api/join-invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ inviteCode: normalizedCode }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to join this group')
  }

  const group = payload?.group
  if (!group?.id) {
    throw new Error('Unable to join this group')
  }

  localStorage.removeItem(PENDING_INVITE_KEY)
  return group
}

async function unlinkTelegramForDeletedGroup({ groupId }) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) throw sessionError
  if (!session?.access_token) return

  const response = await fetch('/api/telegram/unlink-group', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ groupId }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || 'Unable to unlink Telegram connection for this group')
  }
}

export async function deleteGroup({ groupId, userId }) {
  const { data: targetGroup, error: targetGroupError } = await supabase
    .from('groups')
    .select('id,created_by')
    .eq('id', groupId)
    .maybeSingle()

  if (targetGroupError) throw targetGroupError
  if (!targetGroup || targetGroup.created_by !== userId) {
    throw new Error('Only the group owner can delete this group, or it no longer exists.')
  }

  await unlinkTelegramForDeletedGroup({ groupId })

  const { data, error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId)
    .eq('created_by', userId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error('Only the group owner can delete this group, or it no longer exists.')
  }

  return data
}

export async function createTelegramLinkToken({ groupId, createdBy }) {
  if (!groupId || !createdBy) throw new Error('Group and user are required')

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('created_by')
    .eq('id', groupId)
    .maybeSingle()

  if (groupError) throw groupError
  if (!group) throw new Error('Group not found')
  if (group.created_by !== createdBy) {
    throw new Error('Only the group owner can generate Telegram link codes')
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + TELEGRAM_LINK_TOKEN_TTL_MINUTES * 60 * 1000).toISOString()

  const { error: expireError } = await supabase
    .from('telegram_link_tokens')
    .update({ expires_at: now.toISOString() })
    .eq('group_id', groupId)
    .is('used_at', null)
    .gt('expires_at', now.toISOString())

  if (expireError) {
    throw toTelegramRlsError(expireError) || expireError
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = generateInviteCode(TELEGRAM_LINK_TOKEN_LENGTH)
    const { data, error } = await supabase
      .from('telegram_link_tokens')
      .insert({
        group_id: groupId,
        token,
        created_by: createdBy,
        expires_at: expiresAt,
      })
      .select('token,expires_at')
      .maybeSingle()

    if (!error && data) {
      return {
        token: data.token,
        formattedToken: formatTelegramCode(data.token),
        expiresAt: data.expires_at,
        botUsername: TELEGRAM_BOT_USERNAME,
      }
    }

      if (error?.code !== '23505') {
        throw toTelegramRlsError(error) || error
      }

  }

  throw new Error('Unable to generate Telegram link code. Please try again.')
}

export async function fetchTelegramLinkToken({ groupId }) {
  if (!groupId) return null

  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('telegram_link_tokens')
    .select('token,expires_at')
    .eq('group_id', groupId)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    token: data.token,
    formattedToken: formatTelegramCode(data.token),
    expiresAt: data.expires_at,
    botUsername: TELEGRAM_BOT_USERNAME,
  }
}

export async function disconnectTelegramConnection({ groupId }) {
  if (!groupId) return

  const { error } = await supabase
    .from('telegram_connections')
    .update({ is_active: false })
    .eq('group_id', groupId)

  if (error) throw error

  const { error: groupError } = await supabase
    .from('groups')
    .update({ telegram_connected: false, telegram_group_name: null })
    .eq('id', groupId)

  if (groupError) throw groupError
}

export async function updateTelegramSettings({ groupId, settings }) {
  if (!groupId) throw new Error('Group is required')

  const update = {
    expense_alerts_enabled: Boolean(settings?.expense_alerts_enabled),
    payment_alerts_enabled: Boolean(settings?.payment_alerts_enabled),
    daily_reminder_enabled: Boolean(settings?.daily_reminder_enabled),
    reminder_hour: 0,
    reminder_minute: 0,
    reminder_timezone: settings?.reminder_timezone || 'Asia/Singapore',
  }

  const { error } = await supabase.from('telegram_connections').update(update).eq('group_id', groupId)
  if (error) throw error
}

export async function processTelegramOutbox({ botToken }) {
  const normalizedToken = String(botToken || '').trim()
  if (!normalizedToken) {
    throw new Error('Missing Telegram bot token')
  }

  const { data: rows, error } = await supabase
    .from('telegram_outbox')
    .select('id,group_id,event_type,payload,attempts,telegram_connections!inner(telegram_chat_id,telegram_group_name,is_active,expense_alerts_enabled,payment_alerts_enabled,daily_reminder_enabled)')
    .eq('status', 'pending')
    .lte('available_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(25)

  if (error) throw error
  if (!rows || rows.length === 0) {
    return { processed: 0, sent: 0, failed: 0 }
  }

  const messageForEvent = (row) => {
    const payload = row.payload || {}
    if (row.event_type === 'expense_added') {
      return `🧾 New expense in group\n${payload.description || 'Expense'} · ${round2(payload.amount || 0).toFixed(2)}`
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
    const connection = Array.isArray(row.telegram_connections) ? row.telegram_connections[0] : row.telegram_connections

    const skipBySetting =
      !connection?.is_active ||
      (row.event_type === 'expense_added' && !connection?.expense_alerts_enabled) ||
      (row.event_type === 'payment_recorded' && !connection?.payment_alerts_enabled) ||
      (row.event_type === 'daily_reminder' && !connection?.daily_reminder_enabled)

    if (skipBySetting) {
      await supabase
        .from('telegram_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
        .eq('id', row.id)
      continue
    }

    const messageText = messageForEvent(row)
    if (!messageText) {
      await supabase
        .from('telegram_outbox')
        .update({ status: 'failed', error_message: 'Unsupported event type', attempts: Number(row.attempts || 0) + 1 })
        .eq('id', row.id)
      failed += 1
      continue
    }

    const response = await fetch(`https://api.telegram.org/bot${normalizedToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: connection.telegram_chat_id,
        text: messageText,
      }),
    })

    const result = await response.json().catch(() => null)

    if (response.ok && result?.ok) {
      await supabase
        .from('telegram_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
        .eq('id', row.id)
      sent += 1
    } else {
      const attempts = Number(row.attempts || 0) + 1
      const shouldFail = attempts >= 5
      await supabase
        .from('telegram_outbox')
        .update({
          status: shouldFail ? 'failed' : 'pending',
          attempts,
          error_message: result?.description || `HTTP ${response.status}`,
          available_at: shouldFail ? new Date().toISOString() : new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        })
        .eq('id', row.id)
      failed += 1
    }
  }

  return { processed: rows.length, sent, failed }
}

export async function handleTelegramWebhook({ botToken, update }) {
  const normalizedToken = String(botToken || '').trim()
  if (!normalizedToken) throw new Error('Missing Telegram bot token')
  if (!update || typeof update !== 'object') return { ok: true, ignored: true }

  const message = update.message || update.edited_message
  if (!message) return { ok: true, ignored: true }

  const chat = message.chat || {}
  if (chat.type !== 'group' && chat.type !== 'supergroup') {
    return { ok: true, ignored: true }
  }

  const text = String(message.text || '').trim()
  const match = text.match(/^\/link(?:@\w+)?\s+([A-Za-z0-9_-]+)$/i)
  if (!match) {
    return { ok: true, ignored: true }
  }

  const token = normalizeTelegramToken(match[1])
  if (!token) {
    return { ok: false, error: 'Invalid token' }
  }

  const nowIso = new Date().toISOString()
  const { data: linkToken, error: tokenError } = await supabase
    .from('telegram_link_tokens')
    .select('id,group_id,used_at,expires_at')
    .eq('token', token)
    .maybeSingle()

  if (tokenError) throw tokenError

  if (!linkToken || linkToken.used_at || new Date(linkToken.expires_at).getTime() < Date.now()) {
    await fetch(`https://api.telegram.org/bot${normalizedToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat.id,
        text: '❌ Invalid or expired link code. Generate a new one in the app.',
      }),
    })
    return { ok: false, error: 'Invalid or expired token' }
  }

  const { error: connectionError } = await supabase.from('telegram_connections').upsert(
    {
      group_id: linkToken.group_id,
      telegram_chat_id: chat.id,
      telegram_group_name: chat.title || 'Telegram group',
      is_active: true,
      reminder_hour: 0,
      reminder_minute: 0,
      reminder_timezone: 'Asia/Singapore',
    },
    { onConflict: 'group_id' }
  )

  if (connectionError) throw connectionError

  const { error: tokenUpdateError } = await supabase
    .from('telegram_link_tokens')
    .update({ used_at: nowIso, used_chat_id: chat.id, used_chat_title: chat.title || null })
    .eq('id', linkToken.id)

  if (tokenUpdateError) throw tokenUpdateError

  const { error: groupUpdateError } = await supabase
    .from('groups')
    .update({ telegram_connected: true, telegram_group_name: chat.title || 'Telegram group' })
    .eq('id', linkToken.group_id)

  if (groupUpdateError) throw groupUpdateError

  await fetch(`https://api.telegram.org/bot${normalizedToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chat.id,
      text: '✅ KakiSplit is now connected. You will receive expense updates and daily reminders.',
    }),
  })

  return { ok: true, linkedGroupId: linkToken.group_id }
}

export async function queueDailyTelegramReminders({ now = new Date() } = {}) {
  const { data: rows, error } = await supabase
    .from('telegram_connections')
    .select('group_id,telegram_group_name,is_active,daily_reminder_enabled,reminder_hour,reminder_minute,reminder_timezone,last_daily_reminder_date')
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

    if (localNow.getHours() !== hour || localNow.getMinutes() !== minute) {
      continue
    }

    const dateKey = toDateInTimezone(now, timezone)
    if (row.last_daily_reminder_date === dateKey) {
      continue
    }

    const groupData = await fetchGroupData({ groupId: row.group_id, userId: null })
    if (!groupData || !groupData.smartBalances || groupData.smartBalances.length === 0) {
      const { error: updateError } = await supabase
        .from('telegram_connections')
        .update({ last_daily_reminder_date: dateKey })
        .eq('group_id', row.group_id)
      if (updateError) throw updateError
      continue
    }

    const topBalances = groupData.smartBalances
      .slice(0, 5)
      .map((balance) => {
        const fromName = groupData.usersById[balance.from]?.display_name || 'Member'
        const toName = groupData.usersById[balance.to]?.display_name || 'Member'
        return `• ${fromName} owes ${toName} ${round2(balance.amount).toFixed(2)}`
      })

    const reminderMessage = [
      `⏰ Daily reminder for ${groupData.group.name}`,
      `${groupData.smartBalances.length} unsettled balance${groupData.smartBalances.length > 1 ? 's' : ''} remaining:`,
      ...topBalances,
    ].join('\n')

    await enqueueTelegramNotification({
      groupId: row.group_id,
      eventType: 'daily_reminder',
      payload: {
        message: reminderMessage,
        generated_at: now.toISOString(),
      },
    })

    const { error: updateError } = await supabase
      .from('telegram_connections')
      .update({ last_daily_reminder_date: dateKey })
      .eq('group_id', row.group_id)

    if (updateError) throw updateError

    queued += 1
  }

  return { scanned: rows.length, queued }
}

export async function fetchGroupData({ groupId, userId = null }) {
  const { group, members, usersById } = await fetchGroupMembers(groupId)
  if (!group) return null

  const { data: telegramConnection, error: telegramError } = await supabase
    .from('telegram_connections')
    .select('telegram_chat_id,telegram_group_name,is_active,expense_alerts_enabled,payment_alerts_enabled,daily_reminder_enabled,reminder_hour,reminder_minute,reminder_timezone,last_daily_reminder_date')
    .eq('group_id', groupId)
    .maybeSingle()

  const telegramErrorCode = String(telegramError?.code || '')
  const canSkipTelegramState = telegramErrorCode === '42P01' || telegramErrorCode === '42501'
  if (telegramError && !canSkipTelegramState) throw telegramError

  const { data: expenses, error: expensesError } = await supabase
    .from('expenses')
    .select('id,group_id,description,amount,original_amount,original_currency,exchange_rate,paid_by,split_type,category,created_by,created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (expensesError) throw expensesError

  const expenseIds = (expenses || []).map((expense) => expense.id)

  let splits = []
  if (expenseIds.length > 0) {
    const { data: splitRows, error: splitError } = await supabase
      .from('expense_splits')
      .select('expense_id,user_id,amount,is_settled')
      .in('expense_id', expenseIds)

    if (splitError) throw splitError
    splits = splitRows || []
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('id,group_id,from_user_id,to_user_id,amount,created_at')
    .eq('group_id', groupId)

  if (paymentsError) throw paymentsError

  const memberIds = members.map((member) => member.id)
  const splitsByExpenseId = groupBy(splits, (split) => split.expense_id)

  const net = computeNetBalances({
    memberIds,
    expenses: expenses || [],
    splitsByExpenseId,
    payments: payments || [],
  })

  const smartBalances = settleNetBalances(net)
  const myBalances = userId
    ? smartBalances.filter((balance) => balance.from === userId || balance.to === userId)
    : smartBalances

  const mergedExpenses = (expenses || []).map((expense) => ({
    ...expense,
    splits: splitsByExpenseId.get(expense.id) || [],
  }))

  const totalSpent = mergedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)

  return {
    group: {
      ...group,
      telegram_connected: Boolean(telegramConnection?.is_active),
      telegram_group_name: telegramConnection?.telegram_group_name || null,
      telegram_chat_id: telegramConnection?.telegram_chat_id || null,
      telegram_settings: telegramConnection
        ? {
            expense_alerts_enabled: Boolean(telegramConnection.expense_alerts_enabled),
            payment_alerts_enabled: Boolean(telegramConnection.payment_alerts_enabled),
            daily_reminder_enabled: Boolean(telegramConnection.daily_reminder_enabled),
            reminder_hour: telegramConnection.reminder_hour ?? 0,
            reminder_minute: telegramConnection.reminder_minute ?? 0,
            reminder_timezone: telegramConnection.reminder_timezone || 'Asia/Singapore',
            last_daily_reminder_date: telegramConnection.last_daily_reminder_date || null,
          }
        : null,
      member_ids: memberIds,
      total_spent: round2(totalSpent),
    },
    members,
    usersById,
    expenses: mergedExpenses,
    smartBalances,
    myBalances,
  }
}

export async function addExpense({
  groupId,
  amount,
  description,
  category,
  paidBy,
  splitMembers,
  splitType,
  currency,
  createdBy,
  splitValues,
}) {
  const cleanMembers = Array.from(new Set(splitMembers))
  if (!amount || !description || cleanMembers.length === 0) {
    throw new Error('Expense amount, description, and split members are required')
  }

  const normalizedSplitType = splitType || 'equal'
  const numericAmount = round2(amount)
  if (numericAmount <= 0) {
    throw new Error('Expense amount must be greater than 0')
  }

  let shareAmounts = splitEvenly(numericAmount, cleanMembers.length)

  if (normalizedSplitType === 'exact') {
    const parsed = cleanMembers.map((userId) => round2(splitValues?.[userId]))
    const valid = parsed.every((value) => Number.isFinite(value) && value >= 0)
    const sum = round2(parsed.reduce((acc, value) => acc + value, 0))

    if (!valid || parsed.every((value) => value === 0)) {
      throw new Error('Enter valid exact amounts for at least one member')
    }

    if (sum !== numericAmount) {
      throw new Error('Exact split amounts must add up to the total')
    }

    shareAmounts = parsed
  } else if (normalizedSplitType === 'percent') {
    const percentages = cleanMembers.map((userId) => Number(splitValues?.[userId] || 0))
    const valid = percentages.every((value) => Number.isFinite(value) && value >= 0)
    const sum = round2(percentages.reduce((acc, value) => acc + value, 0))

    if (!valid || percentages.every((value) => value === 0)) {
      throw new Error('Enter valid percentages for at least one member')
    }

    if (sum !== 100) {
      throw new Error('Percentages must add up to 100%')
    }

    shareAmounts = splitByWeights(numericAmount, percentages)
  }

  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      group_id: groupId,
      description: description.trim(),
      amount: numericAmount,
      paid_by: paidBy,
        split_type: normalizedSplitType,
      category: category || 'other',
      created_by: createdBy,
      original_amount: null,
      original_currency: currency || null,
      exchange_rate: null,
    })
    .select('*')
    .single()

  if (expenseError) throw expenseError

  const splitRows = cleanMembers.map((userId, index) => ({
    expense_id: expense.id,
    user_id: userId,
    amount: shareAmounts[index],
    is_settled: paidBy === userId,
  }))

  const { error: splitError } = await supabase.from('expense_splits').insert(splitRows)
  if (splitError) throw splitError

  const { error: activityError } = await supabase.from('activity_events').insert({
    group_id: groupId,
    actor_user_id: createdBy,
    event_type: 'expense_added',
    payload: {
      expense_id: expense.id,
      description: expense.description,
      amount: expense.amount,
    },
  })

  if (activityError) throw activityError

  await enqueueTelegramNotification({
    groupId,
    eventType: 'expense_added',
    payload: {
      expense_id: expense.id,
      description: expense.description,
      amount: expense.amount,
      paid_by: paidBy,
      created_by: createdBy,
      split_member_count: cleanMembers.length,
      currency: currency || null,
      split_type: normalizedSplitType,
    },
  })

  return expense
}

export async function createNudge({ groupId, fromUserId, toUserId, amount, message }) {
  const { error } = await supabase.from('nudges').insert({
    group_id: groupId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    message: message || `Reminder: ${round2(amount).toFixed(2)} is due`,
  })

  if (error) throw error
}

export async function recordPayment({ groupId, fromUserId, toUserId, amount, createdBy }) {
  const paymentAmount = round2(amount)
  if (paymentAmount <= 0) throw new Error('Payment amount must be greater than 0')

  const { data, error } = await supabase
    .from('payments')
    .insert({
      group_id: groupId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount: paymentAmount,
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) throw error

  const { error: activityError } = await supabase.from('activity_events').insert({
    group_id: groupId,
    actor_user_id: createdBy,
    event_type: 'payment_recorded',
    payload: {
      payment_id: data.id,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount: paymentAmount,
    },
  })

  if (activityError) throw activityError

  await enqueueTelegramNotification({
    groupId,
    eventType: 'payment_recorded',
    payload: {
      payment_id: data.id,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount: paymentAmount,
      created_by: createdBy,
    },
  })

  return data
}

export async function saveProfile({ userId, profile }) {
  const { data, error } = await supabase
    .from('profiles')
    .update(profile)
    .eq('id', userId)
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error('Profile not found or not writable. Check Supabase RLS policy for profiles.')
  }

  return toAppUser(data)
}

function getAvatarStoragePath(publicUrl) {
  if (!publicUrl) return null

  try {
    const parsedUrl = new URL(publicUrl)
    const marker = '/object/public/avatars/'
    const markerIndex = parsedUrl.pathname.indexOf(marker)
    if (markerIndex === -1) return null
    const path = parsedUrl.pathname.slice(markerIndex + marker.length)
    return decodeURIComponent(path)
  } catch {
    return null
  }
}

export async function uploadAvatar({ userId, file }) {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`

  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, {
    upsert: false,
    cacheControl: '3600',
  })

  if (uploadError) {
    const message = String(uploadError.message || '')
    if (/bucket.*not found/i.test(message)) {
      throw new Error('Avatar bucket is missing in Supabase storage. Create an "avatars" bucket in Storage, then try again.')
    }
    throw uploadError
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
  return data.publicUrl
}

export async function removeAvatar({ avatarUrl }) {
  const filePath = getAvatarStoragePath(avatarUrl)
  if (!filePath) return

  const { error } = await supabase.storage.from('avatars').remove([filePath])
  if (error && !/not found/i.test(String(error.message || ''))) {
    throw error
  }
}

export async function fetchInsightsData(groupId) {
  const { group, members, usersById, expenses } = await fetchGroupData({ groupId, userId: null })
  if (!group) return null

  const byPersonMap = new Map(members.map((member) => [member.id, 0]))
  const byCategoryMap = new Map()

  for (const expense of expenses) {
    byPersonMap.set(expense.paid_by, round2((byPersonMap.get(expense.paid_by) || 0) + Number(expense.amount || 0)))
    byCategoryMap.set(
      expense.category || 'other',
      round2((byCategoryMap.get(expense.category || 'other') || 0) + Number(expense.amount || 0))
    )
  }

  const byPerson = Array.from(byPersonMap.entries()).map(([userId, amount]) => ({
    id: userId,
    name: usersById[userId]?.display_name || 'Unknown',
    amount,
    color: usersById[userId]?.avatar_color || colorFromId(userId),
  }))

  const byCategory = Array.from(byCategoryMap.entries()).map(([name, value]) => ({
    name,
    value,
  }))

  const topExpense = expenses[0]
  const sortedDates = expenses.map((expense) => expense.created_at).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))
  const mostActiveDay = sortedDates[0]

  return {
    group,
    members,
    usersById,
    totalSpend: round2(expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)),
    byPerson,
    byCategory,
    topExpense,
    mostActiveDay,
  }
}
