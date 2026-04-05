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
  const name = String(req.body?.name || '').trim()

  if (!groupId) {
    res.status(400).json({ error: 'groupId is required' })
    return
  }

  if (!name) {
    res.status(400).json({ error: 'Group name is required' })
    return
  }

  const { data: membership, error: membershipError } = await adminSupabase
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    res.status(500).json({ error: membershipError.message || 'Unable to verify group membership' })
    return
  }

  if (!membership) {
    res.status(403).json({ error: 'Only group members can edit group name' })
    return
  }

  const { data: updated, error: updateError } = await adminSupabase
    .from('groups')
    .update({ name })
    .eq('id', groupId)
    .select('id,name')
    .maybeSingle()

  if (updateError) {
    res.status(500).json({ error: updateError.message || 'Unable to update group name' })
    return
  }

  if (!updated) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  res.status(200).json({ ok: true, group: updated })
}
