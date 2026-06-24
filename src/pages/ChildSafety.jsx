import React from 'react'
import { Link } from 'react-router-dom'

export default function ChildSafety() {
  return (
    <div className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-3xl shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-black text-gray-900">Kaki Split Child Safety Standards</h1>
        <p className="text-xs font-semibold text-gray-400 mt-2">Last updated: 23 June 2026</p>
        <p className="text-sm text-gray-600 mt-4">
          Kaki Split is a shared expense tracking app. It does not provide dating features, public social feeds, public
          messaging, or child-directed services. We do not tolerate child sexual abuse and exploitation (CSAE), child
          sexual abuse material (CSAM), grooming, exploitation, or any attempt to use Kaki Split to harm minors.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Prohibited content and conduct</h2>
        <ul className="mt-2 space-y-2 text-sm text-gray-600 list-disc pl-5">
          <li>CSAM, CSAE, grooming, sextortion, trafficking, or sexual exploitation of minors.</li>
          <li>Using group names, expense descriptions, profile information, or invite links to exploit or endanger minors.</li>
          <li>Harassment, abuse, threats, or illegal activity involving minors.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Reporting child safety concerns</h2>
        <p className="text-sm text-gray-600 mt-2">
          Users can report child safety concerns by emailing{' '}
          <a href="mailto:support.kakisplit@gmail.com?subject=Kaki%20Split%20Child%20Safety%20Report" className="font-semibold text-sky-600 hover:text-sky-700">
            support.kakisplit@gmail.com
          </a>
          . Please include relevant details such as the group name, invite link, user display name, and a description of
          the concern. Do not send illegal content by email; describe where it appears in the app.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">How we respond</h2>
        <ul className="mt-2 space-y-2 text-sm text-gray-600 list-disc pl-5">
          <li>We review child safety reports and take action against content, accounts, or groups that violate these standards.</li>
          <li>We may remove content, disable access, preserve relevant records, or restrict accounts where needed for safety.</li>
          <li>Where required by law, we report CSAM or child safety threats to the relevant regional or national authorities.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Designated contact</h2>
        <p className="text-sm text-gray-600 mt-2">
          For child safety compliance questions, contact{' '}
          <a href="mailto:support.kakisplit@gmail.com" className="font-semibold text-sky-600 hover:text-sky-700">
            support.kakisplit@gmail.com
          </a>
          .
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Ongoing compliance</h2>
        <p className="text-sm text-gray-600 mt-2">
          Kaki Split aims to comply with applicable child safety laws and Google Play policies. We may update these
          standards as the app changes or as legal and platform requirements evolve.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link to="/privacy" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
            Privacy Policy
          </Link>
          <Link to="/terms" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  )
}
