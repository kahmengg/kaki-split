import React from 'react'
import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-3xl shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-black text-gray-900">Privacy Policy</h1>
        <p className="text-xs font-semibold text-gray-400 mt-2">Last updated: 22 June 2026</p>
        <p className="text-sm text-gray-600 mt-4">
          Kaki Split helps groups track shared expenses, balances, reminders, and settle-up details. This policy explains
          what information we collect, how we use it, and how you can manage or delete your account.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Information we collect</h2>
        <ul className="mt-2 space-y-2 text-sm text-gray-600 list-disc pl-5">
          <li>Account information such as your email address, display name, login provider, and profile photo.</li>
          <li>Profile settings such as your saved PayNow number, if you choose to add one.</li>
          <li>Group data such as group names, members, invite links, expenses, splits, payments, activity, and deleted activity logs.</li>
          <li>Receipt images or receipt text when you use receipt scanning.</li>
          <li>Telegram connection settings if you choose to connect reminders to a Telegram group.</li>
          <li>Basic technical information needed to keep you signed in, secure the app, and troubleshoot errors.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mt-6">How data is used</h2>
        <ul className="mt-2 space-y-2 text-sm text-gray-600 list-disc pl-5">
          <li>To authenticate users and keep accounts secure.</li>
          <li>To create groups, invite members, calculate balances, and show activity history.</li>
          <li>To scan receipts and help fill expense details faster.</li>
          <li>To provide optional Telegram alerts and reminders.</li>
          <li>To support account deletion, deleted activity logs, and app troubleshooting.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Data sharing</h2>
        <p className="text-sm text-gray-600 mt-2">
          We do not sell your personal data. Data is shared only when needed to provide app functionality, such as showing
          group members shared expenses, processing authentication with Supabase/Google, scanning receipts, or sending
          Telegram reminders you set up.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Payments</h2>
        <p className="text-sm text-gray-600 mt-2">
          Kaki Split does not process, transfer, or verify bank payments. PayNow details are shown only to help members
          settle outside the app using their own banking apps.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Retention</h2>
        <p className="text-sm text-gray-600 mt-2">
          Group expense history is kept so members can understand balances and past activity. Deleted activity logs are
          shown for a limited time where configured. Account deletion removes login and personal profile details while
          preserving anonymized group history needed by other members.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Your choices</h2>
        <p className="text-sm text-gray-600 mt-2">
          You can update profile information in-app. You can also delete your account from Profile, which removes your
          login, personal profile, and saved PayNow details while preserving anonymized shared group history needed by other members.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Contact</h2>
        <p className="text-sm text-gray-600 mt-2">
          For privacy questions or data requests, contact us at{' '}
          <a href="mailto:hello.kakisplit@gmail.com" className="font-semibold text-sky-600 hover:text-sky-700">
            hello.kakisplit@gmail.com
          </a>
          .
        </p>

        <div className="mt-8">
          <Link to="/login" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
