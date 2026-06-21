import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import BottomSheet from '../components/BottomSheet'
import ThemeToggle from '../components/ThemeToggle'
import { useToast } from '../components/Toast'
import { useAppQueryInvalidation, useDashboardData } from '../hooks/useAppQueries'
import { useAuth } from '../hooks/useAuth'
import { useDashboardRealtime } from '../hooks/useRealtimeRefresh'
import { createGroup } from '../lib/kakiSplitApi'
import { formatMoney, timeAgo } from '../lib/format'

function GroupCard({ group, usersById, onClick }) {
  const members = group.member_ids.map((id) => usersById[id]).filter(Boolean)
  const balance = group.my_balance
  const visibleMembers = members.slice(0, 4)
  const overflow = members.length - 4

  return (
    <button onClick={onClick} className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left active:scale-[0.98] transition-transform shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-base truncate">{group.name}</h3>
          <p className="text-gray-400 text-xs mt-0.5">{timeAgo(group.last_activity)}</p>
        </div>
        <div className="flex-shrink-0 ml-3 text-right">
          {balance === 0 ? (
            <span className="text-gray-400 text-sm font-medium">Settled &#10003;</span>
          ) : balance < 0 ? (
            <div>
              <div className="text-red-500 font-bold text-sm">-{formatMoney(Math.abs(balance), group.base_currency)}</div>
              <div className="text-red-400 text-xs">you owe</div>
            </div>
          ) : (
            <div>
              <div className="text-sky-600 font-bold text-sm">+{formatMoney(balance, group.base_currency)}</div>
              <div className="text-sky-500 text-xs">owed to you</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex -space-x-2">
          {visibleMembers.map((member) => (
            <Avatar key={member.id} user={member} size="sm" className="border-2 border-white" />
          ))}
          {overflow > 0 && (
            <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-500">
              +{overflow}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400">{formatMoney(group.total_spent, group.base_currency)} total</span>
      </div>
    </button>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { user, profile } = useAuth()
  const { invalidateDashboard } = useAppQueryInvalidation()
  const dashboardQuery = useDashboardData(user?.id)

  const [showNewGroup, setShowNewGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [currency, setCurrency] = useState('SGD')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (dashboardQuery.error) {
      showToast(dashboardQuery.error.message || 'Failed to load groups', 'error')
    }
  }, [dashboardQuery.error, showToast])

  const groups = dashboardQuery.data?.groups || []
  const usersById = dashboardQuery.data?.usersById || {}
  const loading = dashboardQuery.isLoading
  useDashboardRealtime({ userId: user?.id, groups })

  const totalOwed = useMemo(() => groups.reduce((sum, group) => (group.my_balance > 0 ? sum + group.my_balance : sum), 0), [groups])
  const totalOwe = useMemo(() => groups.reduce((sum, group) => (group.my_balance < 0 ? sum + Math.abs(group.my_balance) : sum), 0), [groups])

  // Show amber alert only when a debt owed-to-you is stale (last activity > 24h ago)
  const staleOwedGroup = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return groups.find((group) => group.my_balance > 0 && new Date(group.last_activity).getTime() < cutoff)
  }, [groups])

  const firstGroupOwed = groups.find((group) => group.my_balance > 0)

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return
    setCreating(true)
    try {
      const newGroup = await createGroup({ userId: user.id, name: groupName, baseCurrency: currency })
      showToast('Group created successfully', 'success')
      setShowNewGroup(false)
      setGroupName('')
      await invalidateDashboard(user.id)
        navigate(`/groups/${newGroup.id}`, {
          state: { openTelegramOnboarding: true },
        })

    } catch (error) {
      showToast(error.message || 'Unable to create group', 'error')
    } finally {
      setCreating(false)
    }
  }

  const currentUser = profile
    ? {
        ...profile,
        name: profile.display_name,
      }
    : user
    ? {
        id: user.id,
        name: user.email?.split('@')[0] || 'You',
        display_name: user.email?.split('@')[0] || 'You',
        email: user.email,
          avatar_color: '#0ea5e9',
      }
    : null

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white px-5 pt-12 pb-5 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Hi, {currentUser?.display_name || currentUser?.name || 'Friend'}</h1>
              <p className="text-gray-500 text-sm mt-0.5">Here's your expense overview</p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => navigate('/profile')}
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-sky-400"
                aria-label="Open profile"
                title="Open profile"
              >
                <Avatar user={currentUser} size="lg" />
              </button>
            </div>
          </div>


        <div className="flex gap-3 mt-2">
          {totalOwe > 0 && (
            <div className="flex-1 bg-red-50 rounded-2xl p-3 border border-red-100">
              <div className="text-xs text-red-400 font-medium">You owe</div>
              <div className="text-red-600 font-bold text-lg">{formatMoney(totalOwe)}</div>
            </div>
          )}
          {totalOwed > 0 && (
            <div className="flex-1 bg-sky-50 rounded-2xl p-3 border border-sky-100">
              <div className="text-xs text-sky-500 font-medium">Owed to you</div>
              <div className="text-sky-700 font-bold text-lg">{formatMoney(totalOwed)}</div>
            </div>
          )}
          {totalOwe === 0 && totalOwed === 0 && (
            <div className="flex-1 bg-gray-50 rounded-2xl p-3 border border-gray-100">
              <div className="text-xs text-gray-400 font-medium">All balances</div>
              <div className="text-gray-700 font-bold text-lg">Settled up &#10003;</div>
            </div>
          )}
        </div>
      </div>

      {staleOwedGroup && (
        <div className="px-4 pt-4">
          <div className="bg-amber-100 border border-amber-200 rounded-2xl p-3.5 flex items-center gap-2.5">
            <span className="text-base">⏰</span>
            <div className="flex-1 min-w-0">
              <p className="text-amber-900 text-xs font-semibold leading-relaxed">
                Overdue &middot; You are owed {formatMoney(staleOwedGroup.my_balance, staleOwedGroup.base_currency)} from{' '}
                <span className="font-bold">{staleOwedGroup.name}</span> for over 24h.
              </p>
            </div>
            <button
              onClick={() => navigate(`/groups/${staleOwedGroup.id}`)}
              className="text-amber-800 font-bold text-xs bg-amber-200 px-2.5 py-1.5 rounded-full flex-shrink-0 active:scale-95 transition-transform"
            >
              Nudge
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">Your groups</h2>
          <button onClick={() => setShowNewGroup(true)} className="flex items-center gap-1.5 text-sky-600 text-sm font-semibold">
            <span className="text-lg leading-none">+</span> New
          </button>
        </div>

        {loading ? (
          <div className="py-14 flex justify-center">
            <div className="w-9 h-9 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="text-6xl mb-4">&#127836;</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No groups yet</h3>
            <p className="text-gray-500 text-sm mb-6">Create a group for your next trip or dinner</p>
            <button onClick={() => setShowNewGroup(true)} className="w-full py-3.5 bg-sky-500 text-white rounded-2xl font-bold mb-3">
              Create a group
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} usersById={usersById} onClick={() => navigate(`/groups/${group.id}`)} />
            ))}
          </div>
        )}
      </div>

      <BottomNav onFABPress={() => setShowNewGroup(true)} />

      <BottomSheet isOpen={showNewGroup} onClose={() => setShowNewGroup(false)} title="New Group">
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Group name</label>
            <input
              type="text"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Bali Trip"
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Base currency</label>
            <div className="grid grid-cols-3 gap-2">
              {['SGD', 'USD', 'EUR', 'AUD', 'MYR', 'IDR'].map((value) => (
                <button
                  key={value}
                  onClick={() => setCurrency(value)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${currency === value ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-600'}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || creating}
            className="w-full py-4 bg-sky-500 text-white rounded-2xl font-bold text-base disabled:opacity-50 mt-2"
            style={{ boxShadow: '0 4px 16px rgba(14, 165, 233, 0.3)' }}
          >
            {creating ? 'Creating...' : 'Create group'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
