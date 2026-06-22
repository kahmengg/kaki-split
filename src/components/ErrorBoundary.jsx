import React from 'react'
import { logClientError } from '../lib/clientErrorLogger'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    logClientError(error, {
      source: 'react-error-boundary',
      componentStack: info?.componentStack,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
          <div className="max-w-sm rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-sm">
            <p className="text-xl font-black text-gray-900">Something went wrong</p>
            <p className="mt-2 text-sm leading-6 text-gray-500">Please restart the app. If this keeps happening, contact support.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 w-full rounded-full bg-sky-500 py-3 text-sm font-bold text-white"
            >
              Restart app
            </button>
            <a href="mailto:hello.kakisplit@gmail.com" className="mt-4 block text-sm font-semibold text-sky-600">
              Contact support
            </a>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
