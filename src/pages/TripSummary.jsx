import React, { useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GROUPS, USERS, INSIGHTS_DATA, formatMoney } from '../data/mockData'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'

export default function TripSummary() {
  const { id } = useParams()
  const navigate = useNavigate()
  const cardRef = useRef(null)
  const group = GROUPS.find(g => g.id === id)
  const data = INSIGHTS_DATA[id] || INSIGHTS_DATA['group-1']

  if (!group) return null

  const members = group.member_ids.map(uid => USERS[uid]).filter(Boolean)

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${group.name} — Trip Summary`,
        text: `We spent ${formatMoney(data?.totalSpend || 0)} on our trip! Check it out on FairSplit.`,
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/groups/${id}`)} className="text-gray-500 -ml-1">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-xl font-black text-gray-900">Trip Summary</h1>
        </div>
      </div>

      <div className="px-4 pt-5">
        {/* Shareable card */}
        <div ref={cardRef} className="rounded-3xl overflow-hidden shadow-xl">
          {/* Card background */}
          <div
            className="relative p-6"
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #0891b2 100%)',
            }}
          >
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-16 -translate-x-8" />

            <div className="relative">
              {/* Logo */}
              <div className="flex items-center gap-1.5 mb-5">
                <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center">
                  <span className="text-emerald-600 font-black text-xs">FS</span>
                </div>
                <span className="text-white/80 text-xs font-semibold">FairSplit</span>
              </div>

              {/* Group name */}
              <h2 className="text-3xl font-black text-white mb-1">{group.name}</h2>
              <p className="text-emerald-200 text-sm mb-6">March 2026</p>

              {/* Big number */}
              <div className="mb-6">
                <p className="text-emerald-200 text-sm font-medium">Total spent together</p>
                <p className="text-5xl font-black text-white">{formatMoney(data?.totalSpend || 0)}</p>
              </div>

              {/* Member avatars */}
              <div className="flex -space-x-2 mb-6">
                {members.map(user => (
                  <Avatar key={user.id} user={user} size="md" className="border-2 border-white/40" />
                ))}
              </div>

              {/* Category breakdown */}
              {data?.byCategory && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {data.byCategory.map(cat => (
                    <div key={cat.name} className="bg-white/15 rounded-2xl p-3">
                      <div className="text-lg mb-0.5">{cat.icon}</div>
                      <div className="text-white font-bold text-sm">{formatMoney(cat.value)}</div>
                      <div className="text-white/60 text-xs">{cat.name}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/20">
                <p className="text-white/60 text-xs">{members.length} friends · all settled ✓</p>
                <p className="text-white/60 text-xs">fairsplit.app</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={handleShare}
            className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
            style={{ boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)' }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            Share
          </button>
          <button
            onClick={() => {}}
            className="flex-1 py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Save image
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Share this recap with your group 🎉
        </p>
      </div>

      <BottomNav groupId={id} onFABPress={() => navigate(`/groups/${id}`)} />
    </div>
  )
}
