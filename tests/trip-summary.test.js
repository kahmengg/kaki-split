import test from 'node:test'
import assert from 'node:assert/strict'
import { recordedPeriod, summaryText } from '../src/lib/tripSummary.js'

test('recap uses recorded dates, including Singapore midnight, rather than today', () => {
  assert.equal(recordedPeriod([{ created_at: '2025-01-02T17:00:00Z' }, { created_at: '2025-01-01T00:00:00Z' }]), '1 Jan 2025 – 3 Jan 2025')
  assert.equal(recordedPeriod([{ created_at: 'invalid' }]), 'No dated expenses recorded yet')
  assert.equal(recordedPeriod([]), 'No expenses recorded yet')
})

test('shared text explains currency, record period, members and expense count', () => {
  const text = summaryText({ group: { name: 'Weekend', base_currency: 'USD' }, totalSpend: 24, members: [{ id: 'a' }], expenses: [{ created_at: '2025-01-01T00:00:00Z' }] })
  assert.match(text, /Weekend/)
  assert.match(text, /USD 24.00/)
  assert.match(text, /1 expense · 1 member/)
  assert.match(text, /Recorded: 1 Jan 2025/)
})
