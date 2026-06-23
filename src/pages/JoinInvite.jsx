import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { joinGroupByInviteCode, fetchGroupData } from '../lib/kakiSplitApi'
import { queryKeys } from '../lib/queryClient'

const PENDING_INVITE_KEY = 'kakisplit:pendingInviteCode'

export default function JoinInvite() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const showToast = useToast()
  const { user, loading, session } = useAuth()
  const [joining, setJoining] = useState(false)
  const [joinStep, setJoinStep] = useState('Checking invite...')
  const [joinedGroupName, setJoinedGroupName] = useState('')
  const joinedRef = useRef(false)

  const normalizedCode = useMemo(() => String(inviteCode || '').trim().toUpperCase(), [inviteCode])

  useEffect(() => {
    if (!normalizedCode) {
      showToast('Invalid invite link', 'error')
      navigate('/dashboard', { replace: true })
    }
  }, [navigate, normalizedCode, showToast])

  useEffect(() => {
    if (loading || !user?.id || !normalizedCode || joinedRef.current) return

    let isMounted = true
    joinedRef.current = true

      async function join() {
        setJoining(true)
        setJoinStep('Joining group...')
        try {
          const group = await joinGroupByInviteCode({
            inviteCode: normalizedCode,
            userId: user.id,
            accessToken: session?.access_token,
          })
          if (!isMounted) return
          setJoinedGroupName(group.name || '')
          setJoinStep('Loading group...')
          showToast(`Joined ${group.name || 'group'}!`, 'success')

          // Warm the group page query before navigation so the next screen can
          // reuse the same in-flight request instead of starting cold.
          queryClient.prefetchQuery({
            queryKey: queryKeys.group(group.id, user.id),
            queryFn: () => fetchGroupData({ groupId: group.id, userId: user.id }),
          })

          window.setTimeout(() => {
            navigate(`/groups/${group.id}`, { replace: true })
          }, 80)
        } catch (error) {
          if (!isMounted) return

          const message = String(error?.message || '')
          if (message.toLowerCase().includes('auth token was released because another request stole it')) {
            window.setTimeout(() => {
              joinedRef.current = false
            }, 300)
            return
          }

          showToast(error.message || 'Unable to join this group', 'error')
          navigate('/dashboard', { replace: true })
        } finally {
          if (isMounted) setJoining(false)
        }
      }


    join()

    return () => {
      isMounted = false
    }
  }, [loading, navigate, normalizedCode, queryClient, session?.access_token, showToast, user?.id])

  const goToLogin = () => {
    localStorage.setItem(PENDING_INVITE_KEY, normalizedCode)
    navigate(`/login?invite=${encodeURIComponent(normalizedCode)}`, { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-gray-100 p-6 text-center shadow-sm">
        <div className="text-4xl mb-3">🤝</div>
        <h1 className="text-xl font-black text-gray-900">Group invite</h1>
        <p className="text-sm text-gray-500 mt-2">
          Invite code: <span className="font-mono font-bold text-gray-700">{normalizedCode || '---'}</span>
        </p>

        {loading ? (
          <div className="mt-6 flex justify-center">
            <div className="w-9 h-9 border-4 border-sky-200 border-t-sky-500 rounded-full app-spinner" />
          </div>
        ) : user ? (
          <div className="mt-5 space-y-2">
            <p className="text-sm text-gray-600">{joining ? joinStep : joinedGroupName ? `Joined ${joinedGroupName}` : 'Preparing invite...'}</p>
            {joining && <p className="text-xs text-gray-400">Setting up your group view now.</p>}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-gray-600">Sign in first, then we will auto-join this group.</p>
            <button onClick={goToLogin} className="w-full py-3 bg-sky-500 text-white rounded-2xl font-bold text-sm">
              Sign in to join
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
