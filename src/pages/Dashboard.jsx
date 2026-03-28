import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GROUPS, USERS, CURRENT_USER, formatMoney, timeAgo } from '../data/mockData'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import BottomSheet from '../components/BottomSheet'

function GroupCard({ group, onClick }) {
  const members = group.member_ids.map(id => USERS[id]).filter(Boolean)
  const balance = group.my_balance
  const visibleMembers = members.slice(0, 4)
  const overflow = members.length - 4

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left active:scale-[0.98] transition-transform shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-base truncate">{group.name}</h3>
          <p className="text-gray-400 text-xs mt-0.5">{timeAgo(group.last_activity)}</p>
        </div>
        <div className="flex-shrink-0 ml-3 text-right">
          {balance === 0 ? (
            <span className="text-gray-400 text-sm font-medium">Settled ✓</span>
          ) : balance < 0 ? (
            <div>
              <div className="text-red-500 font-bold text-sm">−{formatMoney(Math.abs(balance))}</div>
              <div className="text-red-400 text-xs">you owe</div>
            </div>
          ) : (
            <div>
              <div className="text-emerald-600 font-bold text-sm">+{formatMoney(balance)}</div>
              <div className="text-emerald-500 text-xs">owed to you</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        {/* Member avatars */}
        <div className="flex -space-x-2">
          {visibleMembers.map(user => (
            <Avatar key={user.id} user={user} size="sm" className="border-2 border-white" />
          ))}
          {overflow > 0 && (
            <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-500">
              +{overflow}
            </div>
          )}
        </div>
        {/* Total */}
        <span className="text-xs text-gray-400">
          {formatMoney(group.total_spent)} total
        </span>
      </div>
    </button>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [currency, setCurrency] = useState('SGD')

  const totalOwed = GROUPS.reduce((sum, g) => g.my_balance > 0 ? sum + g.my_balance : sum, 0)
  const totalOwe = GROUPS.reduce((sum, g) => g.my_balance < 0 ? sum + Math.abs(g.my_balance) : sum, 0)
  const firstGroupOwed = GROUPS.find(g => g.my_balance > 0)

  const handleCreateGroup = () => {
    navigate('/dashboard')
    setShowNewGroup(false)
    setGroupName('')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Hi, {CURRENT_USER.display_name} 👋</h1>
            <p className="text-gray-500 text-sm mt-0.5">Here's your expense overview</p>
          </div>
          <Avatar user={CURRENT_USER} size="lg" />
        </div>

        {/* Balance summary strip */}
        <div className="flex gap-3 mt-2">
          {totalOwe > 0 && (
            <div className="flex-1 bg-red-50 rounded-2xl p-3 border border-red-100">
              <div className="text-xs text-red-400 font-medium">You owe</div>
              <div className="text-red-600 font-bold text-lg">{formatMoney(totalOwe)}</div>
            </div>
          )}
          {totalOwed > 0 && (
            <div className="flex-1 bg-emerald-50 rounded-2xl p-3 border border-emerald-100">
              <div className="text-xs text-emerald-500 font-medium">Owed to you</div>
              <div className="text-emerald-700 font-bold text-lg">{formatMoney(totalOwed)}</div>
            </div>
          )}
          {totalOwe === 0 && totalOwed === 0 && (
            <div className="flex-1 bg-gray-50 rounded-2xl p-3 border border-gray-100">
              <div className="text-xs text-gray-400 font-medium">All balances</div>
              <div className="text-gray-700 font-bold text-lg">Settled up ✓</div>
            </div>
          )}
        </div>
      </div>

        {/* 24h debt reminder */}
        {firstGroupOwed && (
          <div className="px-4 pt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center gap-2.5">
              <span className="text-base">⏰</span>
              <div className="flex-1 min-w-0">
                <p className="text-amber-800 text-xs font-medium leading-relaxed">
                  You are owed {formatMoney(totalOwed)} from {firstGroupOwed.name} in the last 24h.
                </p>
              </div>
              <button
                onClick={() => navigate(`/groups/${firstGroupOwed.id}`)}
                className="text-amber-700 font-bold text-xs bg-amber-100 px-2.5 py-1.5 rounded-full flex-shrink-0"
              >
                Remind
              </button>
            </div>
          </div>
        )}

        {/* Groups list */}
        <div className="px-4 pt-5">

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">Your groups</h2>
          <button
            onClick={() => setShowNewGroup(true)}
            className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold"
          >
            <span className="text-lg leading-none">+</span> New
          </button>
        </div>

        {GROUPS.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="text-6xl mb-4">🍜</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No groups yet</h3>
            <p className="text-gray-500 text-sm mb-6">Create a group for your next trip or dinner</p>
            <button
              onClick={() => setShowNewGroup(true)}
              className="w-full py-3.5 bg-emerald-500 text-white rounded-2xl font-bold mb-3"
            >
              Create a group
            </button>
            <button className="w-full py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-2xl font-semibold">
              Join with a link
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {GROUPS.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                onClick={() => navigate(`/groups/${group.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <BottomNav onFABPress={() => setShowNewGroup(true)} />

      {/* Create Group Sheet */}
      <BottomSheet
        isOpen={showNewGroup}
        onClose={() => setShowNewGroup(false)}
        title="New Group"
      >
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Group name</label>
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Bali Trip 🌴"
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Base currency</label>
            <div className="grid grid-cols-3 gap-2">
              {['SGD', 'USD', 'EUR', 'AUD', 'MYR', 'IDR'].map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${currency === c ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreateGroup}
            disabled={!groupName.trim()}
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-base disabled:opacity-50 mt-2"
            style={{ boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)' }}
          >
            Create group
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-400">or</p>
            <button className="text-emerald-600 font-semibold text-sm mt-1">
              Join with invite link
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
