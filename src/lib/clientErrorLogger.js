function serializeError(error) {
  if (!error) return { message: 'Unknown error' }

  return {
    name: String(error.name || 'Error').slice(0, 120),
    message: String(error.message || error).slice(0, 500),
    stack: String(error.stack || '').split('\n').slice(0, 8).join('\n'),
  }
}

export function logClientError(error, context = {}) {
  const payload = {
    error: serializeError(error),
    context: {
      source: context.source || 'unknown',
      componentStack: String(context.componentStack || '').slice(0, 1200),
      path: window.location.pathname,
      userAgent: window.navigator.userAgent,
      timestamp: new Date().toISOString(),
    },
  }

  // Keep this local on Vercel Hobby to avoid adding another Serverless Function.
  // Swap this for Sentry or another hosted logger before a larger public launch.
  console.error('[client-error]', payload)
}
