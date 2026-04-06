import React from 'react'
import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-3xl shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-black text-gray-900">Terms of Service</h1>
        <p className="text-sm text-gray-600 mt-3">
          By using KakiSplit, you agree to use the app lawfully and responsibly. You are responsible for the accuracy of
          expenses, payments, and member information you enter.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Use of the service</h2>
        <ul className="mt-2 space-y-2 text-sm text-gray-600 list-disc pl-5">
          <li>Do not use the app for fraud, abuse, or illegal activity.</li>
          <li>Keep your account credentials secure.</li>
          <li>You are responsible for data shared with group members.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Availability</h2>
        <p className="text-sm text-gray-600 mt-2">
          We aim to keep the service available, but uptime is not guaranteed and features may change over time.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Contact</h2>
        <p className="text-sm text-gray-600 mt-2">For questions, contact the app owner or administrator.</p>

        <div className="mt-8">
          <Link to="/login" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
