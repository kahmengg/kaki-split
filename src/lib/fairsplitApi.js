import { supabase } from './supabase'
import { computeNetBalances, settleNetBalances } from './balances'

const PROFILE_COLUMNS = 'id,display_name,email,avatar_url,avatar_color,paynow_number,grabpay_handle,paylah_handle'

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
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

function splitEvenly(totalAmount, peopleCount) {
  const totalCents = Math.round(Number(totalAmount || 0) * 100)
  const base = Math.floor(totalCents / peopleCount)
  const remainder = totalCents - base * peopleCount

  return Array.from({ length: peopleCount }, (_, index) => {
    const cents = base + (index < remainder ? 1 : 0)
    return cents / 100
  })
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

export async function fetchGroupData({ groupId, userId = null }) {
  const { group, members, usersById } = await fetchGroupMembers(groupId)
  if (!group) return null

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
}) {
  const cleanMembers = Array.from(new Set(splitMembers))
  if (!amount || !description || cleanMembers.length === 0) {
    throw new Error('Expense amount, description, and split members are required')
  }

  const numericAmount = round2(amount)
  const shareAmounts = splitEvenly(numericAmount, cleanMembers.length)

  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      group_id: groupId,
      description: description.trim(),
      amount: numericAmount,
      paid_by: paidBy,
      split_type: splitType || 'equal',
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

export async function uploadAvatar({ userId, file }) {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`

  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, {
    upsert: false,
    cacheControl: '3600',
  })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
  return data.publicUrl
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
