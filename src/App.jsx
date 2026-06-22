import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider, useToast } from './components/Toast'
import { useAuth } from './hooks/useAuth'
import { logClientError } from './lib/clientErrorLogger'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const GroupHome = lazy(() => import('./pages/GroupHome'))
const PayScreen = lazy(() => import('./pages/Pay'))
const Insights = lazy(() => import('./pages/Insights'))
const InsightsPicker = lazy(() => import('./pages/InsightsPicker'))
const TripSummary = lazy(() => import('./pages/TripSummary'))
const Activity = lazy(() => import('./pages/Activity'))
const Profile = lazy(() => import('./pages/Profile'))
const JoinInvite = lazy(() => import('./pages/JoinInvite'))
const Terms = lazy(() => import('./pages/Terms'))
const Privacy = lazy(() => import('./pages/Privacy'))
const AuthVerified = lazy(() => import('./pages/AuthVerified'))

function PageFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
    </div>
  )
}

function RequireAuth({ children }) {
  const { user, loading, session } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Loading your account...</p>
          <p className="text-xs text-gray-400 mt-2">If this takes too long, refresh the page.</p>
        </div>
      </div>
    )
  }

  if (!user && !session) {
    return <Navigate to="/login" replace />
  }

  return children
}

function PublicOnly({ children }) {
  const { user, loading, authError, session } = useAuth()
  const showToast = useToast()

  useEffect(() => {
    if (!authError) return
    showToast(authError, 'error')
  }, [authError, showToast])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (user || session) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default function App() {
  useEffect(() => {
    const handleError = (event) => {
      logClientError(event.error || new Error(event.message), { source: 'window-error' })
    }

    const handleRejection = (event) => {
      logClientError(event.reason || new Error('Unhandled promise rejection'), { source: 'unhandled-rejection' })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return (
    <ToastProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <Login />
                </PublicOnly>
              }
            />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/auth/verified" element={<AuthVerified />} />



            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route path="/join/:inviteCode" element={<JoinInvite />} />

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
              path="/insights"
              element={
                <RequireAuth>
                  <InsightsPicker />
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
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </ToastProvider>
  )
}
