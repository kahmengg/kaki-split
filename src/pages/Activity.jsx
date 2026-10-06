import React from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import ThemeToggle from '../components/ThemeToggle'
import { useActivityData, useDashboardData } from '../hooks/useAppQueries'
import { useDashboardRealtime } from '../hooks/useRealtimeRefresh'
import { useAuth } from '../hooks/useAuth'
import { activityLabel, activityRows } from '../lib/activityFeed'
import { formatMoney, timeAgo } from '../lib/format'

export default function Activity() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const dashboardQuery = useDashboardData(user?.id)
  const activityQuery = useActivityData(user?.id)
  useDashboardRealtime({ userId: user?.id, groups: dashboardQuery.data?.groups || [] })
  const rows = activityRows(activityQuery.data?.pages)
  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white px-5 pt-12 pb-5 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button aria-label="Back to dashboard" onClick={() => navigate('/dashboard')} className="text-gray-500">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 5-7 7 7 7" /></svg>
          </button>
          <div><h1 className="text-xl font-black text-gray-900">Activity</h1><p className="text-gray-500 text-sm">Recent updates across your groups</p></div>
        </div>
        <ThemeToggle />
      </div>
      <div className="px-4 pt-5 space-y-3">
        {activityQuery.error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-red-700 text-sm">Unable to load activity. Your existing records are safe.</p>
            <button onClick={() => activityQuery.refetch()} className="mt-2 font-bold text-red-700">Try again</button>
          </div>
        )}
        {activityQuery.isLoading ? <p role="status" className="text-center py-12 text-gray-600">Loading activity…</p> : !rows.length && !activityQuery.error ? (
          <div className="text-center py-12">
            <h2 className="font-bold text-xl text-gray-900">No activity yet</h2>
            <p className="text-sm text-gray-600 mt-2 mb-5">New expenses, corrections and payment records appear here.</p>
            <button onClick={() => navigate('/dashboard')} className="bg-sky-500 text-white px-5 py-3 rounded-2xl font-bold">Go to dashboard</button>
          </div>
        ) : (
          <ol className="space-y-3" aria-label="Group activity timeline">
            {rows.map(event => (
              <li key={event.id}>
                <button onClick={() => navigate(`/groups/${event.group_id}`)} className="w-full bg-white rounded-2xl border border-gray-200 p-4 text-left shadow-sm">
                  <p className="text-sm font-semibold text-sky-600 break-words">{event.group_name}</p>
                  <p className="text-base font-bold text-gray-900 mt-1 break-words">{activityLabel(event)}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                    <p className="text-sm text-gray-600">{event.actor_name || 'Member'} · <time dateTime={event.created_at} title={new Date(event.created_at).toLocaleString('en-SG')}>{timeAgo(event.created_at)}</time></p>
                    {Number.isFinite(Number(event.payload?.amount)) && event.payload?.amount != null && <p className="font-semibold text-gray-900">{formatMoney(Number(event.payload.amount), event.base_currency)}</p>}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Open group →</p>
                </button>
              </li>
            ))}
          </ol>
        )}
        {activityQuery.hasNextPage && <button onClick={() => activityQuery.fetchNextPage()} disabled={activityQuery.isFetchingNextPage} className="w-full rounded-2xl border border-gray-200 bg-white py-3 font-bold text-gray-700 disabled:opacity-60">{activityQuery.isFetchingNextPage ? 'Loading…' : 'Load older activity'}</button>}
        <p className="text-sm text-gray-500 text-center">Payment entries are manual records. Deleted logs remain visible for one month.</p>
      </div>
      <BottomNav />
    </div>
  )
}
