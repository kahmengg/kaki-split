import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import { useToast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { fetchDashboardData } from '../lib/fairsplitApi'
import { formatMoney, timeAgo } from '../lib/format'

function ActivityGroupRow({ group, usersById, onOpen }) {
  const members = (group.member_ids || []).map((id) => usersById[id]).filter(Boolean)
  const balance = Number(group.my_balance || 0)
  const latestMembers = members.slice(0, 4)
  const overflow = Math.max(0, members.length - latestMembers.length)

  return (
    <button
      onClick={onOpen}
      className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left active:scale-[0.98] transition-transform shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-gray-900 text-base truncate">{group.name}</h3>
          <p className="text-gray-400 text-xs mt-0.5">Last activity {timeAgo(group.last_activity)}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {balance === 0 ? (
            <p className="text-gray-400 text-sm font-semibold">Settled</p>
          ) : balance < 0 ? (
            <>
              <p className="text-red-500 font-bold text-sm">-{formatMoney(Math.abs(balance), group.base_currency)}</p>
              <p className="text-red-400 text-xs">you owe</p>
            </>
          ) : (
            <>
              <p className="text-emerald-600 font-bold text-sm">+{formatMoney(balance, group.base_currency)}</p>
              <p className="text-emerald-500 text-xs">owed to you</p>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2">
          {latestMembers.map((member) => (
            <Avatar key={member.id} user={member} size="sm" className="border-2 border-white" />
          ))}
          {overflow > 0 && (
            <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-500">
              +{overflow}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400">{formatMoney(group.total_spent, group.base_currency)} total</p>
      </div>
    </button>
  )
}

export default function Activity() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { user } = useAuth()

  const [groups, setGroups] = useState([])
  const [usersById, setUsersById] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return

    async function loadActivity() {
      setLoading(true)
      try {
        const data = await fetchDashboardData(user.id)
        setGroups(data.groups || [])
        setUsersById(data.usersById || {})
      } catch (error) {
        showToast(error.message || 'Failed to load activity', 'error')
      } finally {
        setLoading(false)
      }
    }

    loadActivity()
  }, [showToast, user?.id])

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white px-5 pt-12 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-gray-500 -ml-1" aria-label="Back to dashboard">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900">Activity</h1>
            <p className="text-gray-500 text-xs">Recent updates across your groups</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5">
        {loading ? (
          <div className="py-14 flex justify-center">
            <div className="w-9 h-9 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="text-5xl mb-4">🧾</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No activity yet</h2>
            <p className="text-gray-500 text-sm mb-6">Create or join a group to start tracking expenses.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3.5 bg-emerald-500 text-white rounded-2xl font-bold"
              style={{ boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)' }}
            >
              Go to dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <ActivityGroupRow
                key={group.id}
                group={group}
                usersById={usersById}
                onOpen={() => navigate(`/groups/${group.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav onFABPress={() => navigate('/dashboard')} />
    </div>
  )
}
