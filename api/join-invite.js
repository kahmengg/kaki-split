import { adminSupabase } from './_lib/db.js'

function getBearerToken(req) {
  const header = String(req.headers.authorization || '')
  if (!header.toLowerCase().startsWith('bearer ')) return ''
  return header.slice(7).trim()
}

function normalizeInviteCode(value) {
  return String(value || '').trim().toUpperCase()
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

  const inviteCode = normalizeInviteCode(req.body?.inviteCode)
  if (!inviteCode) {
    res.status(400).json({ error: 'Invite code is missing' })
    return
  }

  const { data: group, error: groupError } = await adminSupabase
    .from('groups')
    .select('id,name,invite_code')
    .eq('invite_code', inviteCode)
    .maybeSingle()

  if (groupError) {
    res.status(500).json({ error: groupError.message || 'Unable to resolve invite code' })
    return
  }

  if (!group) {
    res.status(404).json({ error: 'Invalid invite code' })
    return
  }

  const { error: membershipError } = await adminSupabase.from('group_members').upsert(
    {
      group_id: group.id,
      user_id: user.id,
      role: 'member',
    },
    { onConflict: 'group_id,user_id', ignoreDuplicates: true }
  )

  if (membershipError) {
    res.status(500).json({ error: membershipError.message || 'Unable to join group' })
    return
  }

  res.status(200).json({
    ok: true,
    group: {
      id: group.id,
      name: group.name,
      invite_code: group.invite_code,
    },
  })
}
