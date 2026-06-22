import React from 'react'
import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-3xl shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-black text-gray-900">Terms of Service</h1>
        <p className="text-xs font-semibold text-gray-400 mt-2">Last updated: 22 June 2026</p>
        <p className="text-sm text-gray-600 mt-4">
          These Terms govern your use of Kaki Split. By using the app, you agree to use it responsibly and only for lawful
          personal group expense tracking.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Use of the service</h2>
        <ul className="mt-2 space-y-2 text-sm text-gray-600 list-disc pl-5">
          <li>Do not use the app for fraud, abuse, or illegal activity.</li>
          <li>Keep your account credentials secure.</li>
          <li>You are responsible for the accuracy of expenses, payments, member information, and PayNow details you enter.</li>
          <li>Only add people to groups or Telegram reminders where you have permission to do so.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Expense and payment records</h2>
        <p className="text-sm text-gray-600 mt-2">
          Kaki Split helps calculate balances and record settle-ups, but it does not move money, process bank transfers,
          or verify whether an external payment was actually completed. Members are responsible for checking payment
          details and resolving disputes with each other.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Receipt scanning and reminders</h2>
        <p className="text-sm text-gray-600 mt-2">
          Receipt scanning and Telegram reminders are provided for convenience. Scanned receipt results may be incomplete
          or incorrect, so you should review expense details before saving them.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Account deletion</h2>
        <p className="text-sm text-gray-600 mt-2">
          You can delete your account from the Profile page. Deletion removes your login and personal details while
          preserving anonymized group history needed for other members' records.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Availability</h2>
        <p className="text-sm text-gray-600 mt-2">
          We aim to keep Kaki Split available, but uptime is not guaranteed. Features may change, pause, or be removed as
          the app improves.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Contact</h2>
        <p className="text-sm text-gray-600 mt-2">
          For support or questions, contact{' '}
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
