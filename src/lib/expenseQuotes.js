export function normalizeExpenseQuote(quote, fromCurrency, toCurrency) {
  const rate = Number(Number(quote?.rate).toFixed(6))
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('The currency quote is unavailable. Retry before saving.')
  return { fromCurrency, toCurrency, rate, source: quote.source || 'unknown',
    asOfDate: /^\d{4}-\d{2}-\d{2}$/.test(quote.asOfDate || '') ? quote.asOfDate : null,
    fallback: Boolean(quote.fallback), saved: Boolean(quote.saved) }
}

export function quoteMatches(quote, fromCurrency, toCurrency) {
  return quote?.fromCurrency === fromCurrency && quote?.toCurrency === toCurrency && Number.isFinite(quote.rate) && quote.rate > 0
}

export function quoteNeedsNotice(quote, now = Date.now()) {
  const date = Date.parse(`${quote?.asOfDate}T00:00:00Z`)
  return Boolean(quote?.fallback) || !Number.isFinite(date) || now - date > 3 * 86400000
}
