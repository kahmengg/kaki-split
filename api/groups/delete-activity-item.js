import { createClient } from '@supabase/supabase-js'
import { adminSupabase } from '../_lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const header = String(req.headers.authorization || '')
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) return res.status(401).json({ error: 'Missing authorization token' })
  const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token)
  if (authError || !user?.id) return res.status(401).json({ error: 'Invalid authorization token' })
  const { groupId, itemId, itemType, expectedRevision } = req.body || {}
  if (!groupId || !itemId) return res.status(400).json({ error: 'groupId and itemId are required' })
  if (itemType === 'payment') return res.status(409).json({ error: 'Open payment details and void this record with a reason.' })
  if (itemType !== 'expense') return res.status(400).json({ error: 'Invalid activity type' })
  if (!Number.isInteger(expectedRevision)) return res.status(409).json({ error: 'Refresh the app before deleting this expense.' })
  // Forward the caller JWT: the database, rather than the service client, checks admin access.
  const caller = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await caller.rpc('delete_group_expense', { p_group_id: groupId, p_expense_id: itemId, p_expected_revision: expectedRevision })
  if (error) return res.status(error.code === 'P0001' ? 409 : 500).json({ error: error.message || 'Unable to delete expense' })
  return res.status(200).json(data)
}
