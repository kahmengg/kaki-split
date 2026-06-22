import { adminSupabase } from '../_lib/db.js'

function getBearerToken(req) {
  const header = String(req.headers.authorization || '')
  if (!header.toLowerCase().startsWith('bearer ')) return ''
  return header.slice(7).trim()
}

async function insertDeletedLog({ groupId, deletedBy, itemType, itemId, snapshot }) {
  const expiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await adminSupabase.from('deleted_activity_logs').insert({
    group_id: groupId,
    deleted_by: deletedBy,
    item_type: itemType,
    item_id: itemId,
    item_snapshot: snapshot,
    expires_at: expiresAt,
  })

  if (error) throw error
}

function warningFromError(error, fallback) {
  return error?.message || fallback
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = getBearerToken(req)
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' })
    return
  }

  const {
    data: { user },
    error: userError,
  } = await adminSupabase.auth.getUser(token)

  if (userError || !user?.id) {
    res.status(401).json({ error: 'Invalid authorization token' })
    return
  }

  const groupId = String(req.body?.groupId || '').trim()
  const itemType = String(req.body?.itemType || '').trim().toLowerCase()
  const itemId = String(req.body?.itemId || '').trim()

  if (!groupId) {
    res.status(400).json({ error: 'groupId is required' })
    return
  }

  if (!itemId) {
    res.status(400).json({ error: 'itemId is required' })
    return
  }

  if (!['expense', 'payment'].includes(itemType)) {
    res.status(400).json({ error: 'itemType must be one of expense, payment' })
    return
  }

  const { data: group, error: groupError } = await adminSupabase
    .from('groups')
    .select('id,created_by')
    .eq('id', groupId)
    .maybeSingle()

  if (groupError) {
    res.status(500).json({ error: groupError.message || 'Unable to verify group ownership' })
    return
  }

  if (!group || group.created_by !== user.id) {
    res.status(403).json({ error: 'Only the group owner can delete activity items' })
    return
  }

  if (itemType === 'expense') {
    const warnings = []
    const { data: targetExpense, error: expenseLookupError } = await adminSupabase
      .from('expenses')
      .select('*')
      .eq('id', itemId)
      .eq('group_id', groupId)
      .maybeSingle()

    if (expenseLookupError) {
      res.status(500).json({ error: expenseLookupError.message || 'Unable to find expense' })
      return
    }

    if (!targetExpense) {
      res.status(404).json({ error: 'Expense not found in this group' })
      return
    }

    try {
      await insertDeletedLog({
        groupId,
        deletedBy: user.id,
        itemType: 'expense',
        itemId,
        snapshot: targetExpense,
      })
    } catch (logError) {
      warnings.push(warningFromError(logError, 'Deleted-log entry could not be created'))
    }

    const { error: deleteExpenseError } = await adminSupabase.from('expenses').delete().eq('id', itemId).eq('group_id', groupId)
    if (deleteExpenseError) {
      res.status(500).json({ error: deleteExpenseError.message || 'Unable to delete expense' })
      return
    }

    const { error: deleteExpenseEventError } = await adminSupabase
      .from('activity_events')
      .delete()
      .eq('group_id', groupId)
      .eq('event_type', 'expense_added')
      .contains('payload', { expense_id: itemId })

    if (deleteExpenseEventError) {
      warnings.push(warningFromError(deleteExpenseEventError, 'Linked activity event could not be removed'))
    }

    res.status(200).json({ ok: true, warnings })
    return
  }

  if (itemType === 'payment') {
    const warnings = []
    const { data: targetPayment, error: paymentLookupError } = await adminSupabase
      .from('payments')
      .select('*')
      .eq('id', itemId)
      .eq('group_id', groupId)
      .maybeSingle()

    if (paymentLookupError) {
      res.status(500).json({ error: paymentLookupError.message || 'Unable to find payment' })
      return
    }

    if (!targetPayment) {
      res.status(404).json({ error: 'Payment not found in this group' })
      return
    }

    try {
      await insertDeletedLog({
        groupId,
        deletedBy: user.id,
        itemType: 'payment',
        itemId,
        snapshot: targetPayment,
      })
    } catch (logError) {
      warnings.push(warningFromError(logError, 'Deleted-log entry could not be created'))
    }

    const { error: deletePaymentError } = await adminSupabase.from('payments').delete().eq('id', itemId).eq('group_id', groupId)
    if (deletePaymentError) {
      res.status(500).json({ error: deletePaymentError.message || 'Unable to delete payment' })
      return
    }

    const { error: deletePaymentEventError } = await adminSupabase
      .from('activity_events')
      .delete()
      .eq('group_id', groupId)
      .eq('event_type', 'payment_recorded')
      .contains('payload', { payment_id: itemId })

    if (deletePaymentEventError) {
      warnings.push(warningFromError(deletePaymentEventError, 'Linked activity event could not be removed'))
    }

    res.status(200).json({ ok: true, warnings })
    return
  }
}
