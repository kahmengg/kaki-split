function sanitizeValue(value, depth = 0) {
  if (depth > 3) return '[truncated]'
  if (value == null) return value
  if (typeof value === 'string') return value.slice(0, 500)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => sanitizeValue(item, depth + 1))
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/token|secret|password|authorization|cookie|email/i.test(key))
        .slice(0, 20)
        .map(([key, item]) => [key, sanitizeValue(item, depth + 1)])
    )
  }
  return String(value).slice(0, 500)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const payload = sanitizeValue(req.body || {})
  console.error('[client-error]', JSON.stringify(payload))
  res.status(204).end()
}
