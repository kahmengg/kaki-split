import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function JoinGroup() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const { user } = useAuth()

  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    async function loadInvite() {
      if (!inviteCode) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const normalizedCode = inviteCode.trim().toUpperCase()
        const { data, error } = await supabase
          .from('groups')
          .select('id,name,invite_code')
          .eq('invite_code', normalizedCode)
          .maybeSingle()

        if (error) throw error
        setGroup(data || null)
      } catch (error) {
        showToast(error.message || 'Unable to load invite', 'error')
      } finally {
        setLoading(false)
      }
    }

    loadInvite()
  }, [inviteCode, showToast])

  const handleJoin = async () => {
    if (!group?.id || !user?.id) return

    setJoining(true)
    try {
      const { error } = await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'member',
      })

      if (error && error.code !== '23505') {
        throw error
      }

      showToast('Joined group successfully', 'success')
      navigate(`/groups/${group.id}`)
    } catch (error) {
      showToast(error.message || 'Unable to join group', 'error')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center max-w-sm w-full">
          <p className="text-4xl mb-3">🔍</p>
          <h1 className="text-lg font-bold text-gray-900">Invite not found</h1>
          <p className="text-sm text-gray-500 mt-1">This invite code is invalid or has expired.</p>
          <button onClick={() => navigate('/dashboard')} className="mt-5 w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold">
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-sm w-full">
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Group invite</p>
        <h1 className="text-xl font-black text-gray-900 mt-2">Join {group.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Code: {group.invite_code}</p>

        <button
          onClick={handleJoin}
          disabled={joining}
          className="mt-6 w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold disabled:opacity-60"
        >
          {joining ? 'Joining...' : 'Join group'}
        </button>

        <button onClick={() => navigate('/dashboard')} className="mt-3 w-full py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold">
          Cancel
        </button>
      </div>
    </div>
  )
}
