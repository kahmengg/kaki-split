import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import BottomSheet from './BottomSheet'
import { useAuth } from '../hooks/useAuth'
import { useDashboardData } from '../hooks/useAppQueries'

const HomeIcon = ({ filled }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="w-6 h-6"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
    />
  </svg>
)

const ActivityIcon = ({ filled }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="w-6 h-6"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
  </svg>
)

const InsightsIcon = ({ filled }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="w-6 h-6"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15.75l3.75-3.75 2.25 2.25 4.5-5.25" />
  </svg>
)

const ProfileIcon = ({ filled }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="w-6 h-6"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
    />
  </svg>
)

export default function BottomNav({ onFABPress, groupId }) {
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname
  const [showAdd, setShowAdd] = useState(false)
  const [chooseGroup, setChooseGroup] = useState(false)
  const { user } = useAuth()
  const groupsQuery = useDashboardData(showAdd ? user?.id : null)

  const activeGroupId = useMemo(() => {
    if (groupId) return groupId
    const [, route, id] = path.split('/')
    if (route === 'groups' && id) return id
    return null
  }, [groupId, path])

  useEffect(() => {
    if (!activeGroupId) return
    localStorage.setItem('kakisplit:lastGroupId', activeGroupId)
  }, [activeGroupId])

  const activityGroupId = useMemo(
    () => activeGroupId || localStorage.getItem('kakisplit:lastGroupId') || null,
    [activeGroupId],
  )

  const isHome = path === '/dashboard' || path === '/'
  const isActivity = path === '/activity'
  const isInsights = path === '/insights' || /^\/groups\/[^/]+\/insights$/.test(path)
  const isProfile = path === '/profile'

  const handleInsightsPress = () => {
    navigate('/insights')
  }

  const openExpense = (id) => {
    setShowAdd(false)
    if (path === `/groups/${id}`) onFABPress?.()
    else navigate(`/groups/${id}`, { state: { openExpense: true } })
  }

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="app-bottom-nav fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 z-40"
      >
        <div
          className="grid grid-cols-5 items-end px-2 pt-2 pb-4"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <button
            aria-current={isHome ? 'page' : undefined}
            onClick={() => navigate('/dashboard')}
            className={`flex flex-col items-center gap-0.5 py-1 rounded-xl transition-all ${isHome ? 'text-sky-600' : 'text-gray-600'}`}
          >
            <HomeIcon filled={isHome} />
            <span className="text-xs font-medium">Home</span>
          </button>

          <button
            aria-current={isActivity ? 'page' : undefined}
            onClick={() => navigate('/activity')}
            className={`flex flex-col items-center gap-0.5 py-1 rounded-xl transition-all ${isActivity ? 'text-sky-600' : 'text-gray-600'}`}
            title={activityGroupId ? 'Open latest group activity' : 'View your recent group activity'}
          >
            <ActivityIcon filled={isActivity} />
            <span className="text-xs font-medium">Activity</span>
          </button>

          <button
            onClick={() => {
              // The page context determines the primary creation action.
              if (activeGroupId) {
                openExpense(activeGroupId)
                return
              }
              if (isHome) {
                if (onFABPress) onFABPress()
                else navigate('/dashboard', { state: { openNewGroup: true } })
                return
              }
              setChooseGroup(false)
              setShowAdd(true)
            }}
            className="mx-auto w-14 h-14 rounded-full bg-sky-500 shadow-lg flex items-center justify-center -mt-6 flex-shrink-0 active:scale-95 transition-transform"
            style={{ boxShadow: '0 4px 20px rgba(14, 165, 233, 0.45)' }}
            aria-label={activeGroupId ? 'Add expense' : isHome ? 'Create group' : 'Add expense or create group'}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>

          <button
            aria-current={isInsights ? 'page' : undefined}
            onClick={handleInsightsPress}
            className={`flex flex-col items-center gap-0.5 py-1 rounded-xl transition-all ${isInsights ? 'text-sky-600' : 'text-gray-600'}`}
            title={activeGroupId ? 'View group insights' : 'Insights require a group'}
          >
            <InsightsIcon filled={isInsights} />
            <span className="text-xs font-medium">Insights</span>
          </button>

          <button
            aria-current={isProfile ? 'page' : undefined}
            onClick={() => navigate('/profile')}
            className={`flex flex-col items-center gap-0.5 py-1 rounded-xl transition-all ${isProfile ? 'text-sky-600' : 'text-gray-600'}`}
          >
            <ProfileIcon filled={isProfile} />
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </nav>
      <BottomSheet isOpen={showAdd} onClose={() => setShowAdd(false)} title={chooseGroup ? 'Choose a group' : 'Add'}>
        <div className="px-5 py-4 space-y-3">
          {!chooseGroup ? (
            <>
              <button
                type="button"
                className="w-full rounded-2xl bg-sky-500 text-white py-4 font-bold"
                onClick={() => (activeGroupId ? openExpense(activeGroupId) : setChooseGroup(true))}
              >
                Add expense
              </button>
              <button
                type="button"
                className="w-full rounded-2xl border border-gray-200 py-4 text-gray-700 font-semibold"
                onClick={() => {
                  setShowAdd(false)
                  if (isHome) onFABPress?.()
                  else navigate('/dashboard', { state: { openNewGroup: true } })
                }}
              >
                Create group
              </button>
            </>
          ) : groupsQuery.isLoading ? (
            <p role="status">Loading your groups...</p>
          ) : groupsQuery.error ? (
            <div role="alert">
              <p>Unable to load groups.</p>
              <button type="button" className="min-h-11 text-sky-700 font-bold" onClick={() => groupsQuery.refetch()}>
                Retry
              </button>
            </div>
          ) : groupsQuery.data?.groups.length ? (
            groupsQuery.data.groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className="w-full text-left rounded-2xl border border-gray-200 p-4 font-semibold text-gray-900 break-words"
                onClick={() => openExpense(group.id)}
              >
                {group.name}
              </button>
            ))
          ) : (
            <>
              <p className="text-sm text-gray-600">Create a group before adding an expense.</p>
              <button
                type="button"
                className="min-h-11 text-sky-700 font-bold"
                onClick={() => {
                  setShowAdd(false)
                  navigate('/dashboard', { state: { openNewGroup: true } })
                }}
              >
                Create your first group
              </button>
            </>
          )}
        </div>
      </BottomSheet>
    </>
  )
}
