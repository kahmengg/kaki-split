import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeExpenses, expenseToDraft, convertedExpenseAmount } from '../src/lib/expenseReview.js'

test('FX half-cent rounding agrees with the decimal database calculation', () => {
  assert.equal(convertedExpenseAmount(1, 'USD', 1.005), 1.01)
  assert.equal(convertedExpenseAmount(0.01, 'USD', 1.5), 0.02)
})

test('largest expense and busiest Singapore calendar day are independent of recency', () => {
  const data = summarizeExpenses([
    { id: 'new', amount: 5, created_at: '2026-10-05T02:00:00Z' },
    { id: 'big', amount: 80, created_at: '2026-10-03T17:00:00Z' },
    { id: 'other', amount: 10, created_at: '2026-10-04T03:00:00Z' },
    { id: 'invalid', amount: 1, created_at: 'invalid' },
  ])
  assert.equal(data.topExpense.id, 'big')
  assert.equal(data.mostActiveDay, '2026-10-04')
  assert.equal(data.mostActiveDayCount, 2)
  assert.deepEqual(summarizeExpenses([]), { topExpense: null, mostActiveDay: null, mostActiveDayCount: 0 })
})

test('ties use the most recent day and expense deterministically', () => {
  const data = summarizeExpenses([
    { id: 'old', amount: 10, created_at: '2026-10-01T01:00:00Z' },
    { id: 'new', amount: 10, created_at: '2026-10-02T01:00:00Z' },
  ])
  assert.equal(data.topExpense.id, 'new')
  assert.equal(data.mostActiveDay, '2026-10-02')
})

test('foreign expense editing preserves original total and reconciles rounded allocations', () => {
  const draft = expenseToDraft({ amount: 10, original_amount: 33.33, original_currency: 'MYR', exchange_rate: 0.3,
    description: 'Meal', paid_by: 'a', split_type: 'percent', category: 'food',
    splits: [{ user_id: 'a', amount: 3.33 }, { user_id: 'b', amount: 6.67 }] }, 'SGD')
  assert.equal(draft.amount, '33.33')
  assert.equal(draft.currency, 'MYR')
  assert.equal(draft.splitType, 'exact')
  assert.equal(Math.round(Object.values(draft.splitValues).reduce((sum, value) => sum + Number(value), 0) * 100), 3333)
})

test('text-only corrections retain accounting totals even when legacy FX metadata is rounded', () => {
  const saved = { amount: 84.34, original_amount: 1000000, original_currency: 'IDR', exchange_rate: 0.000084 }
  assert.equal(convertedExpenseAmount(1000000, 'IDR', 0.000084, saved), 84.34)
  assert.equal(convertedExpenseAmount(2000000, 'IDR', 0.000084, saved), 168)
  assert.equal(convertedExpenseAmount(100, 'MYR', 0.3, saved), 30)
})
