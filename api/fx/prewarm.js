import { adminSupabase } from '../_lib/db.js'

const DEFAULT_BASE = 'SGD'
const DEFAULT_QUOTES = ['USD', 'EUR', 'JPY', 'MYR', 'THB', 'IDR', 'AUD', 'GBP', 'CNY', 'HKD']

function toDateKey(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10)
}

async function fetchFrankfurterRate({ fromCurrency, toCurrency }) {
  const from = String(fromCurrency || '').trim().toUpperCase()
  const to = String(toCurrency || '').trim().toUpperCase()

  if (!from || !to) throw new Error('Missing currency code')
  if (from === to) {
    return { rate: 1, asOfDate: toDateKey(), source: 'identity' }
  }

  const response = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`)
  const payload = await response.json().catch(() => null)
  const rate = Number(payload?.rates?.[to])
  const asOfDate = String(payload?.date || '').trim() || toDateKey()

  if (!response.ok || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(payload?.error || `Unable to fetch exchange rate (${from} to ${to})`)
  }

  return { rate, asOfDate, source: 'frankfurter' }
}

async function upsertRate({ fromCurrency, toCurrency, rate, asOfDate, source }) {
  const from = String(fromCurrency || '').trim().toUpperCase()
  const to = String(toCurrency || '').trim().toUpperCase()
  const dateKey = String(asOfDate || '').trim()

  if (!from || !to || !dateKey) return { skipped: true }

  const { error } = await adminSupabase.from('fx_rates').upsert(
    {
      base_currency: from,
      quote_currency: to,
      rate: Number(rate),
      as_of_date: dateKey,
      source: source || 'frankfurter',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'base_currency,quote_currency,as_of_date' }
  )

  if (error) throw error
  return { skipped: false }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = String(req.headers.authorization || '')
  const cronSecret = String(process.env.CRON_SECRET || '').trim()
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const requestedBase = String(req.query?.base || DEFAULT_BASE).trim().toUpperCase() || DEFAULT_BASE
  const requestedQuotesRaw = String(req.query?.quotes || '')
  const requestedQuotes = requestedQuotesRaw
    ? requestedQuotesRaw
        .split(',')
        .map((item) => String(item || '').trim().toUpperCase())
        .filter(Boolean)
    : DEFAULT_QUOTES

  const quotes = Array.from(new Set(requestedQuotes.filter((code) => code !== requestedBase)))

  let refreshed = 0
  let failed = 0
  const errors = []

  for (const quote of quotes) {
    try {
      const result = await fetchFrankfurterRate({ fromCurrency: quote, toCurrency: requestedBase })
      await upsertRate({
        fromCurrency: quote,
        toCurrency: requestedBase,
        rate: result.rate,
        asOfDate: result.asOfDate,
        source: result.source,
      })
      refreshed += 1
    } catch (error) {
      failed += 1
      errors.push({ currency: quote, error: error?.message || 'Unknown error' })
    }
  }

  res.status(200).json({
    ok: true,
    base: requestedBase,
    refreshed,
    failed,
    total: quotes.length,
    errors: errors.slice(0, 10),
  })
}
