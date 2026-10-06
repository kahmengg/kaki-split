import test from 'node:test'
import assert from 'node:assert/strict'
import { draftKey, readDraft, writeDraft, clearDraft } from '../src/lib/expenseDrafts.js'

test('expense drafts recover per account, group and correction revision', () => {
  const rows = new Map()
  const storage = { getItem: key => rows.get(key), setItem: (key, value) => rows.set(key, value), removeItem: key => rows.delete(key) }
  const scope = { userId: 'a', groupId: 'g' }
  const draft = { amount: '20', description: 'Lunch', currency: 'SGD', splitMembers: ['a'], splitValues: {}, sharedItems: [] }
  assert.equal(writeDraft(scope, draft, storage, 100), true)
  assert.deepEqual(readDraft(scope, storage, 101), draft)
  assert.equal(readDraft({ ...scope, userId: 'b' }, storage, 101), null)
  assert.notEqual(draftKey({ ...scope, expenseId: 'e', revision: 1 }), draftKey({ ...scope, expenseId: 'e', revision: 2 }))
  assert.equal(readDraft(scope, storage, 100 + 31 * 86400000), null)
  writeDraft(scope, draft, storage)
  clearDraft(scope, storage)
  assert.equal(readDraft(scope, storage), null)
})

test('corrupted or unavailable draft storage never crashes expense entry', () => {
  const scope = { userId: 'a', groupId: 'g' }
  assert.equal(readDraft(scope, { getItem: () => '{' }), null)
  assert.equal(writeDraft(scope, {}, { setItem: () => { throw Error('Quota') } }), false)
  assert.equal(readDraft({ groupId: 'g' }), null)
})
