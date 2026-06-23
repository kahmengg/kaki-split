import React from 'react'
import { Link } from 'react-router-dom'

export default function AccountDeletion() {
  return (
    <div className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-3xl shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-black text-gray-900">Delete Your Kaki Split Account</h1>
        <p className="text-xs font-semibold text-gray-400 mt-2">Last updated: 23 June 2026</p>
        <p className="text-sm text-gray-600 mt-4">
          Kaki Split lets you request deletion of your account and associated personal data from inside the app or by
          contacting support.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Delete your account in the app</h2>
        <ol className="mt-2 space-y-2 text-sm text-gray-600 list-decimal pl-5">
          <li>Open Kaki Split and sign in with your Google account.</li>
          <li>Go to Profile.</li>
          <li>Tap Delete account.</li>
          <li>Confirm the deletion prompt.</li>
        </ol>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Request deletion by email</h2>
        <p className="text-sm text-gray-600 mt-2">
          If you cannot access the app, email{' '}
          <a href="mailto:hello.kakisplit@gmail.com?subject=Kaki%20Split%20Account%20Deletion" className="font-semibold text-sky-600 hover:text-sky-700">
            hello.kakisplit@gmail.com
          </a>{' '}
          from the Google email address used for your Kaki Split account. Include the request: "Please delete my Kaki
          Split account."
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Data deleted</h2>
        <ul className="mt-2 space-y-2 text-sm text-gray-600 list-disc pl-5">
          <li>Your login profile details, including display name and email shown in Kaki Split.</li>
          <li>Your saved profile photo and avatar details.</li>
          <li>Your saved PayNow number or payment handle, if you added one.</li>
          <li>Your personal Telegram reminder connection, where applicable.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Data retained</h2>
        <p className="text-sm text-gray-600 mt-2">
          Shared group records, expenses, payments, and balances may be retained in anonymized form so other group
          members can still understand their expense history. Deleted activity logs may remain visible to group members
          until their configured expiry period, usually up to 1 month.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Retention period</h2>
        <p className="text-sm text-gray-600 mt-2">
          In-app account deletion is processed immediately. Email deletion requests are normally handled within 30 days.
          Some records may be retained longer if required for security, abuse prevention, legal obligations, or backup
          recovery before being removed from backups through the normal backup lifecycle.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link to="/privacy" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
            Privacy Policy
          </Link>
          <Link to="/login" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
