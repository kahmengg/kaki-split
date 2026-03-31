import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider, useToast } from './components/Toast'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import GroupHome from './pages/GroupHome'
import PayScreen from './pages/Pay'
import Insights from './pages/Insights'
import TripSummary from './pages/TripSummary'
import Activity from './pages/Activity'
import Profile from './pages/Profile'

function RequireAuth({ children }) {
  const { user, loading, authError } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Loading your account...</p>
          <p className="text-xs text-gray-400 mt-2">If this takes too long, refresh the page.</p>
        </div>
      </div>
    )
  }

  if (authError || !user) {
    return <Navigate to="/login" replace state={authError ? { authError } : undefined} />
  }

  return children
}

function PublicOnly({ children }) {
  const { user, loading, authError } = useAuth()
  const showToast = useToast()

  useEffect(() => {
    if (!authError) return
    showToast(authError, 'error')
  }, [authError, showToast])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
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
              path="/activity"
              element={
                <RequireAuth>
                  <Activity />
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
      </BrowserRouter>
    </ToastProvider>
  )
}
