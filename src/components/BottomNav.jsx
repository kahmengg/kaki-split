import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const HomeIcon = ({ filled }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
)

const ActivityIcon = ({ filled }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
  </svg>
)

const ProfileIcon = ({ filled }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
)

export default function BottomNav({ onFABPress, groupId }) {
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname

  const isHome = path === '/dashboard' || path === '/'
  const isActivity = path.includes('/groups/') && !path.includes('/insights') && !path.includes('/pay') && !path.includes('/summary')
  const isProfile = path === '/profile'

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 z-40">
      <div className="flex items-center px-3 pt-2 pb-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <button
          onClick={() => navigate('/dashboard')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-1 rounded-xl transition-all ${isHome ? 'text-emerald-600' : 'text-gray-400'}`}
        >
          <HomeIcon filled={isHome} />
          <span className="text-[10px] font-medium">Home</span>
        </button>

        <button
          onClick={() => {
            if (groupId) navigate(`/groups/${groupId}`)
            else navigate('/dashboard')
          }}
          className={`flex-1 flex flex-col items-center gap-0.5 py-1 rounded-xl transition-all ${isActivity ? 'text-emerald-600' : 'text-gray-400'}`}
        >
          <ActivityIcon filled={isActivity} />
          <span className="text-[10px] font-medium">Activity</span>
        </button>

        <button
          onClick={onFABPress}
          className="w-14 h-14 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center -mt-6 flex-shrink-0 active:scale-95 transition-transform"
          style={{ boxShadow: '0 4px 20px rgba(16, 185, 129, 0.45)' }}
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>

        <button
          onClick={() => navigate('/profile')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-1 rounded-xl transition-all ${isProfile ? 'text-emerald-600' : 'text-gray-400'}`}
        >
          <ProfileIcon filled={isProfile} />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </div>
    </div>
  )
}
