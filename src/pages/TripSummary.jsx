import React, { useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import { useToast } from '../components/Toast'
import { useInsightsData } from '../hooks/useAppQueries'
import { useAuth } from '../hooks/useAuth'
import { CATEGORIES, formatMoney } from '../lib/format'

function categoryMeta(categoryId) {
  return CATEGORIES.find((item) => item.id === categoryId) || { icon: '📦', label: categoryId || 'Other' }
}

export default function TripSummary() {
  const { id } = useParams()
  const navigate = useNavigate()
  const cardRef = useRef(null)
  const showToast = useToast()
  const { user } = useAuth()
  const insightsQuery = useInsightsData(id, user?.id)

  useEffect(() => {
    if (insightsQuery.error) {
      showToast(insightsQuery.error.message || 'Unable to load trip summary', 'error')
    }
  }, [insightsQuery.error, showToast])

  const data = insightsQuery.data
  const loading = insightsQuery.isLoading

  const members = useMemo(() => data?.members || [], [data?.members])

  const shareText = useMemo(() => {
    if (!data?.group) return 'Trip summary from Kaki Split.'
    return `We spent ${formatMoney(data.totalSpend, data.group.base_currency)} on ${data.group.name}!`
  }, [data?.group, data?.totalSpend])

  const handleShare = async () => {
    if (!data?.group) return

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${data.group.name} - Trip Summary`,
          text: `${shareText} Check it out on Kaki Split.`,
        })
      } catch {
        // User dismissed share sheet.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(shareText)
      showToast('Summary copied to clipboard', 'success')
    } catch {
      showToast('Unable to copy summary', 'error')
    }
  }

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
          <p className="text-gray-600 font-semibold">No summary available yet.</p>
          <button onClick={() => navigate(`/groups/${id}`)} className="mt-4 px-4 py-2.5 rounded-full bg-sky-500 text-white text-sm font-bold">
            Back to group
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
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
        <div ref={cardRef} className="rounded-3xl overflow-hidden shadow-xl">
          <div
            className="relative p-6"
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #0891b2 100%)',
            }}
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-16 -translate-x-8" />

            <div className="relative">
              <div className="flex items-center gap-1.5 mb-5">
                <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center">
                  <span className="text-sky-600 font-black text-xs">KS</span>
                </div>
                <span className="text-white/80 text-xs font-semibold">Kaki Split</span>
              </div>

              <h2 className="text-3xl font-black text-white mb-1">{data.group.name}</h2>
              <p className="text-sky-200 text-sm mb-6">
                {new Date().toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}
              </p>

              <div className="mb-6">
                <p className="text-sky-200 text-sm font-medium">Total spent together</p>
                <p className="text-5xl font-black text-white">{formatMoney(data.totalSpend, data.group.base_currency)}</p>
              </div>

              <div className="flex -space-x-2 mb-6">
                {members.map((member) => (
                  <Avatar key={member.id} user={member} size="md" className="border-2 border-white/40" />
                ))}
              </div>

              {data.byCategory.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {data.byCategory.slice(0, 4).map((category) => {
                    const meta = categoryMeta(category.name)
                    return (
                      <div key={category.name} className="bg-white/15 rounded-2xl p-3">
                        <div className="text-lg mb-0.5">{meta.icon}</div>
                        <div className="text-white font-bold text-sm">{formatMoney(category.value, data.group.base_currency)}</div>
                        <div className="text-white/60 text-xs">{meta.label}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-white/20">
                <p className="text-white/60 text-xs">{members.length} friends &middot; powered by Kaki Split</p>
                <p className="text-white/60 text-xs">kakisplit.app</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={handleShare}
            className="flex-1 py-4 bg-sky-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
            style={{ boxShadow: '0 4px 16px rgba(14, 165, 233, 0.3)' }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            Share
          </button>
          <button
            onClick={handleShare}
            className="flex-1 py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125V17.25m9-9l-3-3m0 0l-3 3m3-3V15" />
            </svg>
            Copy text
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Share this recap with your group</p>
      </div>

      <BottomNav groupId={id} onFABPress={() => navigate(`/groups/${id}`)} />
    </div>
  )
}
