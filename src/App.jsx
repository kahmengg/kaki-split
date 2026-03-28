import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import GroupHome from './pages/GroupHome'
import PayScreen from './pages/Pay'
import Insights from './pages/Insights'
import TripSummary from './pages/TripSummary'
import Profile from './pages/Profile'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/groups/:id" element={<GroupHome />} />
          <Route path="/groups/:id/pay" element={<PayScreen />} />
          <Route path="/groups/:id/insights" element={<Insights />} />
          <Route path="/groups/:id/summary" element={<TripSummary />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
