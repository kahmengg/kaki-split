import React, { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, PieChart, Pie } from 'recharts'
import BottomNav from '../components/BottomNav'
import { useToast } from '../components/Toast'
import { useInsightsData } from '../hooks/useAppQueries'
import { useAuth } from '../hooks/useAuth'
import { CATEGORIES, formatMoney } from '../lib/format'

const CATEGORY_COLOR = {
  food: '#10b981',
  transport: '#f59e0b',
  accommodation: '#3b82f6',
  activities: '#8b5cf6',
  other: '#94a3b8',
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-gray-900 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-lg">
        {formatMoney(payload[0].value)}
      </div>
    )
  }
  return null
}

function enrichCategory(category) {
  const meta = CATEGORIES.find((item) => item.id === category.name)
  return {
    ...category,
    label: meta?.label || category.name,
    icon: meta?.icon || '📦',
    color: CATEGORY_COLOR[category.name] || '#94a3b8',
  }
}

export default function Insights() {
  const { id } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const { user } = useAuth()
  const insightsQuery = useInsightsData(id, user?.id)

  useEffect(() => {
    if (insightsQuery.error) {
      showToast(insightsQuery.error.message || 'Failed to load insights', 'error')
    }
  }, [insightsQuery.error, showToast])

  const data = insightsQuery.data
  const loading = insightsQuery.isLoading

  const byCategory = useMemo(() => (data?.byCategory || []).map(enrichCategory), [data?.byCategory])
  const maxSpend = Math.max(1, ...(data?.byPerson || []).map((person) => person.amount || 0))

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!data?.group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-gray-600 font-semibold">No insights available for this group yet.</p>
          <button
            onClick={() => navigate(`/groups/${id}`)}
            className="mt-4 px-4 py-2.5 rounded-full bg-sky-500 text-white text-sm font-bold"
          >
            Back to group
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white px-5 pt-12 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate(`/groups/${id}`)} className="text-gray-500 -ml-1">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900">Spend Insights</h1>
            <p className="text-gray-400 text-xs">{data.group.name}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        <div className="bg-gradient-to-br from-sky-500 to-teal-600 rounded-3xl p-6 text-white">
          <p className="text-sky-100 text-sm font-medium mb-1">Total group spend</p>
          <p className="text-4xl font-black">{formatMoney(data.totalSpend, data.group.base_currency)}</p>
          <div className="flex gap-4 mt-3 pt-3 border-t border-white/20">
            <div>
              <p className="text-sky-100 text-xs">Most active day</p>
              <p className="text-white font-bold text-sm">
                {data.mostActiveDay ? new Date(data.mostActiveDay).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) : '—'}
              </p>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <p className="text-sky-100 text-xs">Top expense</p>
              <p className="text-white font-bold text-sm">{data.topExpense?.description || '—'}</p>
            </div>
          </div>
        </div>

        {data.topExpense && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Top expense</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-2xl">🏷️</div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{data.topExpense.description}</p>
                <p className="text-gray-400 text-xs">
                  Paid by {data.usersById[data.topExpense.paid_by]?.display_name || 'Unknown'}
                </p>
              </div>
              <p className="font-black text-gray-900 text-lg">{formatMoney(data.topExpense.amount, data.group.base_currency)}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Spend by person</p>
          <div className="space-y-3">
            {data.byPerson.map((person) => (
              <div key={person.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-700">{person.name}</span>
                  <span className="text-sm font-bold text-gray-900">{formatMoney(person.amount, data.group.base_currency)}</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(person.amount / maxSpend) * 100}%`,
                      backgroundColor: person.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">By category</p>
          {byCategory.length === 0 ? (
            <p className="text-sm text-gray-500">No category data yet.</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <PieChart width={120} height={120}>
                  <Pie
                    data={byCategory}
                    cx={55}
                    cy={55}
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {byCategory.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </div>

              <div className="flex-1 space-y-2">
                {byCategory.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs text-gray-600 font-medium">
                        {cat.icon} {cat.label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-800">{formatMoney(cat.value, data.group.base_currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Member comparison</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.byPerson} barSize={32}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb', radius: 8 }} />
              <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                {data.byPerson.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <BottomNav groupId={id} onFABPress={() => navigate(`/groups/${id}`)} />
    </div>
  )
}
