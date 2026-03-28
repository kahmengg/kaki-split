import React from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import GroupHome from './pages/GroupHome'
import PayScreen from './pages/Pay'
import Insights from './pages/Insights'
import TripSummary from './pages/TripSummary'
import Profile from './pages/Profile'
import JoinGroup from './pages/JoinGroup'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Loading your account...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    const from = `${location.pathname}${location.search}`
    return <Navigate to="/login" state={{ from }} replace />
  }

  return children
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (user) {
    const redirectPath = typeof location.state?.from === 'string' ? location.state.from : '/dashboard'
    return <Navigate to={redirectPath} replace />
  }

  return children
}

export default function App() {
  return (
      <ToastProvider>
        <HashRouter>
          <Routes>

          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />

            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/join/:inviteCode"
              element={
                <RequireAuth>
                  <JoinGroup />
                </RequireAuth>
              }
            />

          <Route
            path="/groups/:id"
            element={
              <RequireAuth>
                <GroupHome />
              </RequireAuth>
            }
          />
          <Route
            path="/groups/:id/pay"
            element={
              <RequireAuth>
                <PayScreen />
              </RequireAuth>
            }
          />
          <Route
            path="/groups/:id/insights"
            element={
              <RequireAuth>
                <Insights />
              </RequireAuth>
            }
          />
          <Route
            path="/groups/:id/summary"
            element={
              <RequireAuth>
                <TripSummary />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </HashRouter>

    </ToastProvider>
  )
}
