import { adminSupabase } from '../_lib/db.js'

function toDateKey(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10)
}

function normalizeCurrency(code) {
  return String(code || '').trim().toUpperCase()
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
  const response = await fetch(`https://api.frankfurter.app/${endpointDate}?from=${fromCurrency}&to=${toCurrency}`)
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

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
