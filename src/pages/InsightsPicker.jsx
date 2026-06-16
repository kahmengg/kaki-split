import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import ThemeToggle from '../components/ThemeToggle'
import { useToast } from '../components/Toast'
import { useDashboardData } from '../hooks/useAppQueries'
import { useAuth } from '../hooks/useAuth'
import { formatMoney, timeAgo } from '../lib/format'

export default function InsightsPicker() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { user } = useAuth()
  const dashboardQuery = useDashboardData(user?.id)

  useEffect(() => {
    if (dashboardQuery.error) {
      showToast(dashboardQuery.error.message || 'Failed to load groups', 'error')
    }
  }, [dashboardQuery.error, showToast])

  const groups = dashboardQuery.data?.groups || []
  const loading = dashboardQuery.isLoading

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white px-5 pt-12 pb-5 border-b border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="text-gray-500 -ml-1" aria-label="Back to dashboard">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900">Insights</h1>
              <p className="text-gray-500 text-xs">Choose a group to view spending insights</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="px-4 pt-5">
        {loading ? (
          <div className="py-14 flex justify-center">
            <div className="w-9 h-9 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No groups yet</h2>
            <p className="text-gray-500 text-sm mb-6">Create or join a group to see insights.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3.5 bg-sky-500 text-white rounded-2xl font-bold"
              style={{ boxShadow: '0 4px 16px rgba(14, 165, 233, 0.3)' }}
            >
              Go to dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => navigate(`/groups/${group.id}/insights`)}
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left active:scale-[0.98] transition-transform shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-gray-900 text-base truncate">{group.name}</h3>
                    <p className="text-gray-400 text-xs mt-0.5">Last activity {timeAgo(group.last_activity)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-gray-800 font-bold text-sm">{formatMoney(group.total_spent, group.base_currency)}</p>
                    <p className="text-gray-400 text-xs">total spend</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav onFABPress={() => navigate('/dashboard')} />
    </div>
  )
}
