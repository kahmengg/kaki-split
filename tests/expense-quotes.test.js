import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeExpenseQuote, quoteMatches, quoteNeedsNotice } from '../src/lib/expenseQuotes.js'

test('conversion uses the stored six decimal rate and the matching currency pair', () => {
  const quote = normalizeExpenseQuote({ rate: 1.23456789, source: 'frankfurter', asOfDate: '2026-10-06' }, 'USD', 'SGD')
  assert.equal(quote.rate, 1.234568)
  assert.equal(quoteMatches(quote, 'USD', 'SGD'), true)
  assert.equal(quoteMatches(quote, 'THB', 'SGD'), false)
  assert.equal(quoteNeedsNotice(quote, Date.parse('2026-10-07')), false)
  assert.equal(quoteNeedsNotice(quote, Date.parse('2026-10-10')), true)
  assert.equal(quoteNeedsNotice({ ...quote, fallback: true }), true)
  assert.equal(quoteNeedsNotice({ ...quote, asOfDate: null }), true)
  assert.throws(() => normalizeExpenseQuote({ rate: NaN }, 'USD', 'SGD'))
})
