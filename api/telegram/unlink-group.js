import { adminSupabase } from '../_lib/db.js'
import { unlinkGroupTelegramConnection } from '../_lib/telegram.js'

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
  if (!groupId) {
    res.status(400).json({ error: 'groupId is required' })
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
    res.status(403).json({ error: 'Only the group owner can unlink Telegram for this group' })
    return
  }

  try {
    await unlinkGroupTelegramConnection({ groupId })
    res.status(200).json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to unlink Telegram for this group' })
  }
}
