import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie
} from 'recharts'
import { GROUPS, INSIGHTS_DATA, formatMoney, USERS } from '../data/mockData'
import BottomNav from '../components/BottomNav'

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

export default function Insights() {
  const { id } = useParams()
  const navigate = useNavigate()
  const group = GROUPS.find(g => g.id === id)
  const data = INSIGHTS_DATA[id]

  if (!group || !data) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-400">No insights available</p>
    </div>
  )

  const maxSpend = Math.max(...data.byPerson.map(p => p.amount))

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate(`/groups/${id}`)} className="text-gray-500 -ml-1">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900">Spend Insights</h1>
            <p className="text-gray-400 text-xs">{group.name}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Total spent hero */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white">
          <p className="text-emerald-100 text-sm font-medium mb-1">Total group spend</p>
          <p className="text-4xl font-black">{formatMoney(data.totalSpend)}</p>
          <div className="flex gap-4 mt-3 pt-3 border-t border-white/20">
            <div>
              <p className="text-emerald-100 text-xs">Most active day</p>
              <p className="text-white font-bold text-sm">{data.mostActiveDay}</p>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <p className="text-emerald-100 text-xs">Top expense</p>
              <p className="text-white font-bold text-sm">{data.topExpense.description}</p>
            </div>
          </div>
        </div>

        {/* Top expense card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Top expense</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-2xl">🏠</div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">{data.topExpense.description}</p>
              <p className="text-gray-400 text-xs">Paid by {USERS[data.topExpense.paid_by]?.display_name} · {data.topExpense.date}</p>
            </div>
            <p className="font-black text-gray-900 text-lg">{formatMoney(data.topExpense.amount)}</p>
          </div>
        </div>

        {/* Spend by person */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Spend by person</p>
          <div className="space-y-3">
            {data.byPerson.map(person => (
              <div key={person.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-700">{person.name}</span>
                  <span className="text-sm font-bold text-gray-900">{formatMoney(person.amount)}</span>
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

        {/* Spend by category */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">By category</p>
          <div className="flex items-center gap-4">
            {/* Donut chart */}
            <div className="flex-shrink-0">
              <PieChart width={120} height={120}>
                <Pie
                  data={data.byCategory}
                  cx={55}
                  cy={55}
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.byCategory.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-2">
              {data.byCategory.map(cat => (
                <div key={cat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-xs text-gray-600 font-medium">{cat.icon} {cat.name}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800">{formatMoney(cat.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar chart */}
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
