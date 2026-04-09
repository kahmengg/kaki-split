import { adminSupabase } from '../_lib/db.js'

function getBearerToken(req) {
  const header = String(req.headers.authorization || '')
  if (!header.toLowerCase().startsWith('bearer ')) return ''
  return header.slice(7).trim()
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
  const confirmationText = String(req.body?.confirmationText || '').trim().toUpperCase()

  if (!groupId) {
    res.status(400).json({ error: 'groupId is required' })
    return
  }

  if (confirmationText !== 'CLEAR') {
    res.status(400).json({ error: 'Type CLEAR to confirm group activity wipe' })
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
    res.status(403).json({ error: 'Only the group owner can clear activity' })
    return
  }

  const { error: expenseDeleteError } = await adminSupabase.from('expenses').delete().eq('group_id', groupId)
  if (expenseDeleteError) {
    res.status(500).json({ error: expenseDeleteError.message || 'Unable to clear expense activity' })
    return
  }

  const { error: paymentDeleteError } = await adminSupabase.from('payments').delete().eq('group_id', groupId)
  if (paymentDeleteError) {
    res.status(500).json({ error: paymentDeleteError.message || 'Unable to clear payment activity' })
    return
  }

  const { error: eventDeleteError } = await adminSupabase.from('activity_events').delete().eq('group_id', groupId)
  if (eventDeleteError) {
    res.status(500).json({ error: eventDeleteError.message || 'Unable to clear activity timeline' })
    return
  }

  res.status(200).json({ ok: true })
}
