import test from 'node:test'
import assert from 'node:assert/strict'
import { activityLabel, activityRows } from '../src/lib/activityFeed.js'

test('timeline describes corrections and deletions without claiming bank verification', () => {
  assert.equal(activityLabel({ event_type: 'expense_updated', payload: { description: 'Taxi' } }), 'Corrected expense: Taxi')
  assert.equal(activityLabel({ event_type: 'payment_recorded' }), 'Recorded payment')
  assert.equal(activityLabel({ event_type: 'payment_deleted' }), 'Deleted payment record')
})

test('overlapping pages retain distinct same-time events and sort newest first', () => {
  const a = { id: 'event:a', created_at: '2026-10-06T00:00:00Z' }
  const b = { id: 'event:b', created_at: '2026-10-06T00:00:00Z' }
  const old = { id: 'event:c', created_at: '2026-10-05T00:00:00Z' }
  assert.deepEqual(activityRows([{ rows: [a, b] }, { rows: [a, old] }]), [b, a, old])
})
