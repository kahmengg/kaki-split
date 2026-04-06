import React from 'react'
import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-3xl shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-black text-gray-900">Privacy Policy</h1>
        <p className="text-sm text-gray-600 mt-3">
          We collect only the data needed to run group expense sharing: account details, group membership, expenses,
          payments, and profile settings.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">How data is used</h2>
        <ul className="mt-2 space-y-2 text-sm text-gray-600 list-disc pl-5">
          <li>To authenticate users and maintain sessions.</li>
          <li>To calculate balances, settlements, and activity history.</li>
          <li>To provide optional notifications and reminders.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Data sharing</h2>
        <p className="text-sm text-gray-600 mt-2">We do not sell personal data. Data is shared only to provide core app functionality.</p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Your choices</h2>
        <p className="text-sm text-gray-600 mt-2">You can update profile information in-app. To request account/data deletion, contact the app owner.</p>

        <div className="mt-8">
          <Link to="/login" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
