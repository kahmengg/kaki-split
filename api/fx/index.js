import { adminSupabase } from '../_lib/db.js'

const DEFAULT_BASE = 'SGD'
const DEFAULT_QUOTES = ['USD', 'EUR', 'JPY', 'MYR', 'THB', 'IDR', 'AUD', 'GBP', 'CNY', 'HKD']

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function toDateKey(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10)
}

function normalizeCurrency(code) {
  return String(code || '').trim().toUpperCase()
}

function isAuthorizedCronRequest(req) {
  const cronSecret = String(process.env.CRON_SECRET || '').trim()
  if (!cronSecret) return false
  const authHeader = String(req.headers.authorization || '')
  return authHeader === `Bearer ${cronSecret}`
}

async function readRate({ fromCurrency, toCurrency, asOfDate }) {
  const { data, error } = await adminSupabase
    .from('fx_rates')
    .select('rate,as_of_date,source')
    .eq('base_currency', fromCurrency)
    .eq('quote_currency', toCurrency)
    .eq('as_of_date', asOfDate)
    .maybeSingle()

  if (error) {
    const code = String(error.code || '')
    if (code === '42P01' || code === '42703' || code === '42501') return null
    throw error
  }

  const rate = Number(data?.rate)
  if (!Number.isFinite(rate) || rate <= 0) return null

  return {
    rate,
    asOfDate: String(data?.as_of_date || asOfDate),
    source: String(data?.source || 'cache_db'),
  }
}

async function readLatestRate({ fromCurrency, toCurrency }) {
  const { data, error } = await adminSupabase
    .from('fx_rates')
    .select('rate,as_of_date,source')
    .eq('base_currency', fromCurrency)
    .eq('quote_currency', toCurrency)
    .order('as_of_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    const code = String(error.code || '')
    if (code === '42P01' || code === '42703' || code === '42501') return null
    throw error
  }

  const rate = Number(data?.rate)
  if (!Number.isFinite(rate) || rate <= 0) return null

  return {
    rate,
    asOfDate: String(data?.as_of_date || toDateKey()),
    source: String(data?.source || 'cache_db'),
  }
}

async function upsertRate({ fromCurrency, toCurrency, rate, asOfDate, source }) {
  const { error } = await adminSupabase.from('fx_rates').upsert(
    {
      base_currency: fromCurrency,
      quote_currency: toCurrency,
      rate,
      as_of_date: asOfDate,
      source,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'base_currency,quote_currency,as_of_date' }
  )

  if (!error) return

  const code = String(error.code || '')
  if (code === '42P01' || code === '42703' || code === '42501') return
  throw error
}

async function fetchFrankfurterRate({ fromCurrency, toCurrency, endpointDate }) {
  const response = await fetch(
    `https://api.frankfurter.dev/v1/${endpointDate}?from=${encodeURIComponent(fromCurrency)}&to=${encodeURIComponent(toCurrency)}`
  )
  const payload = await response.json().catch(() => null)
  const rate = Number(payload?.rates?.[toCurrency])
  const asOfDate = String(payload?.date || endpointDate || '').trim() || toDateKey()

  if (!response.ok || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(payload?.error || `Unable to fetch exchange rate (${fromCurrency} to ${toCurrency})`)
  }

  return {
    rate,
    asOfDate,
    source: 'frankfurter',
  }
}

async function fetchFrankfurterLatestRate({ fromCurrency, toCurrency }) {
  const response = await fetch(
    `https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(fromCurrency)}&to=${encodeURIComponent(toCurrency)}`
  )
  const payload = await response.json().catch(() => null)
  const rate = Number(payload?.rates?.[toCurrency])
  const asOfDate = String(payload?.date || '').trim() || toDateKey()

  if (!response.ok || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(payload?.error || `Unable to fetch exchange rate (${fromCurrency} to ${toCurrency})`)
  }

  return { rate, asOfDate, source: 'frankfurter' }
}

async function handleQuote(req, res) {
  const fromCurrency = normalizeCurrency(req.query?.from)
  const toCurrency = normalizeCurrency(req.query?.to)
  const date = String(req.query?.date || '').trim()
  const endpointDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'latest'

  if (!fromCurrency || !toCurrency) {
    res.status(400).json({ error: 'Missing from/to currency' })
    return
  }

  if (fromCurrency === toCurrency) {
    res.status(200).json({ rate: 1, asOfDate: toDateKey(), source: 'identity' })
    return
  }

  try {
    if (endpointDate !== 'latest') {
      const exact = await readRate({ fromCurrency, toCurrency, asOfDate: endpointDate })
      if (exact) {
        res.status(200).json(exact)
        return
      }
    }

    try {
      const remote = await fetchFrankfurterRate({ fromCurrency, toCurrency, endpointDate })
      await upsertRate({
        fromCurrency,
        toCurrency,
        rate: remote.rate,
        asOfDate: remote.asOfDate,
        source: remote.source,
      })
      res.status(200).json(remote)
      return
    } catch (error) {
      const fallback =
        endpointDate === 'latest'
          ? await readLatestRate({ fromCurrency, toCurrency })
          : await readRate({ fromCurrency, toCurrency, asOfDate: endpointDate })

      if (fallback) {
        res.status(200).json(fallback)
        return
      }

      throw error
    }
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unable to fetch exchange rate' })
  }
}

async function handlePrewarm(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const cronSecret = String(process.env.CRON_SECRET || '').trim()
  if (!cronSecret) {
    res.status(503).json({ error: 'CRON_SECRET is not configured' })
    return
  }

  if (!isAuthorizedCronRequest(req)) {
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
      const result = await fetchFrankfurterLatestRate({ fromCurrency: quote, toCurrency: requestedBase })
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

export default async function handler(req, res) {
  applyCors(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const action = String(req.query?.action || '').trim().toLowerCase()

  if (action === 'prewarm') {
    await handlePrewarm(req, res)
    return
  }

  await handleQuote(req, res)
}
