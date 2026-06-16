import { adminSupabase } from '../_lib/db.js'

function getBearerToken(req) {
  const header = String(req.headers.authorization || '')
  if (!header.toLowerCase().startsWith('bearer ')) return ''
  return header.slice(7).trim()
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

  const groupId = String(req.query?.groupId || '').trim()
  if (!groupId) {
    res.status(400).json({ error: 'groupId is required' })
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
    res.status(403).json({ error: 'Only group members can view deleted logs' })
    return
  }

  const { data, error } = await adminSupabase
    .from('deleted_activity_logs')
    .select('id,group_id,deleted_by,item_type,item_id,item_snapshot,deleted_at,expires_at,profiles:deleted_by(id,display_name,email,avatar_url,avatar_color)')
    .eq('group_id', groupId)
    .gt('expires_at', new Date().toISOString())
    .order('deleted_at', { ascending: false })
    .limit(50)

  if (error) {
    res.status(500).json({ error: error.message || 'Unable to load deleted logs' })
    return
  }

  res.status(200).json({ logs: data || [] })
}
