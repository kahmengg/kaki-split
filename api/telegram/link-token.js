import { adminSupabase } from '../_lib/db.js'

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const TOKEN_LENGTH = 6
const TOKEN_TTL_MINUTES = 30

function getBearerToken(req) {
  const header = String(req.headers.authorization || '')
  if (!header.toLowerCase().startsWith('bearer ')) return ''
  return header.slice(7).trim()
}

function generateToken(length = TOKEN_LENGTH) {
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)]
  }
  return code
}

function formatToken(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .split('')
    .join(' ')
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
    res.status(403).json({ error: 'Only group members can generate Telegram link codes' })
    return
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString()

  const { error: expireError } = await adminSupabase
    .from('telegram_link_tokens')
    .update({ expires_at: nowIso })
    .eq('group_id', groupId)
    .is('used_at', null)
    .gt('expires_at', nowIso)

  if (expireError) {
    res.status(500).json({ error: expireError.message || 'Unable to rotate existing Telegram code' })
    return
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const newToken = generateToken()
    const { data, error } = await adminSupabase
      .from('telegram_link_tokens')
      .insert({
        group_id: groupId,
        token: newToken,
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select('token,expires_at')
      .maybeSingle()

    if (!error && data?.token) {
      res.status(200).json({
        ok: true,
        token: data.token,
        formattedToken: formatToken(data.token),
        expiresAt: data.expires_at,
      })
      return
    }

    if (error?.code !== '23505') {
      res.status(500).json({ error: error.message || 'Unable to generate Telegram link code' })
      return
    }
  }

  res.status(500).json({ error: 'Unable to generate Telegram link code. Please try again.' })
}
