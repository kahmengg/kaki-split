const ERROR_LOG_ENDPOINT = '/api/client-errors'

function serializeError(error) {
  if (!error) return { message: 'Unknown error' }

  return {
    name: String(error.name || 'Error').slice(0, 120),
    message: String(error.message || error).slice(0, 500),
    stack: String(error.stack || '').split('\n').slice(0, 8).join('\n'),
  }
}

export function logClientError(error, context = {}) {
  if (import.meta.env.DEV) {
    console.error('[client-error]', error, context)
  }

  const body = JSON.stringify({
    error: serializeError(error),
    context: {
      source: context.source || 'unknown',
      componentStack: String(context.componentStack || '').slice(0, 1200),
      path: window.location.pathname,
      userAgent: window.navigator.userAgent,
      timestamp: new Date().toISOString(),
    },
  })

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon(ERROR_LOG_ENDPOINT, blob)
    return
  }

  fetch(ERROR_LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}
