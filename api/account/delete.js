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

  // Preserve group expense history while removing personal profile/payment data.
  // The auth user is deleted after this, but this anonymous profile row remains
  // as a tombstone for historical expenses, payments, and group ownership.
  const { data: updatedProfile, error: updateError } = await adminSupabase
    .from('profiles')
    .update({
      display_name: 'Deleted user',
      email: null,
      avatar_url: null,
      avatar_color: '#94a3b8',
      paynow_number: null,
      paylah_handle: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select('id')
    .maybeSingle()

  if (updateError) {
    res.status(500).json({ error: updateError.message || 'Unable to delete account data' })
    return
  }

  if (!updatedProfile) {
    res.status(404).json({ error: 'Profile not found' })
    return
  }

  const { error: deleteUserError } = await adminSupabase.auth.admin.deleteUser(user.id)

  if (deleteUserError) {
    res.status(409).json({
      error:
        'Profile data was anonymized, but the auth account could not be deleted. Run the Supabase profile/auth decoupling migration and try again.',
      details: deleteUserError.message,
    })
    return
  }

  res.status(200).json({ ok: true, authDeleted: true })
}
