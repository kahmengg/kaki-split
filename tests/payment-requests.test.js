import test from 'node:test'
import assert from 'node:assert/strict'
import { computeNetBalances, settleNetBalances } from '../src/lib/balances.js'
import { paymentRequestKey, readPaymentRequest, rememberPaymentRequest, forgetPaymentRequest } from '../src/lib/paymentRequests.js'

test('uncertain payment payload survives reload and is scoped to its recorder', () => {
  const rows = new Map()
  const storage = { getItem: key => rows.get(key) || null, setItem: (key,value) => rows.set(key,value), removeItem: key => rows.delete(key) }
  const scope = { createdBy: 'a', groupId: 'g', fromUserId: 'a', toUserId: 'b' }
  const request = { ...scope, amount: 10, expectedRevision: 3, requestId: '11111111-1111-1111-1111-111111111111' }
  rememberPaymentRequest(request,storage)
  assert.deepEqual(readPaymentRequest(scope,storage),request)
  assert.equal(readPaymentRequest({ ...scope, createdBy:'b' },storage),null)
  storage.setItem(paymentRequestKey(scope), JSON.stringify({ ...request, amount: null }))
  assert.equal(readPaymentRequest(scope,storage),null)
  forgetPaymentRequest(scope,storage)
  assert.equal(storage.getItem(paymentRequestKey(scope)),null)
})

test('voided payments have no ledger effect; settlement ties are deterministic', () => {
  const net = computeNetBalances({ memberIds:['b','a'], expenses:[{id:'e',paid_by:'b',amount:20}], splitsByExpenseId:new Map([['e',[{user_id:'a',amount:10},{user_id:'b',amount:10}]]]), payments:[{from_user_id:'a',to_user_id:'b',amount:10,voided_at:'2026-10-06'}] })
  assert.deepEqual(settleNetBalances(net),[{from:'a',to:'b',amount:10}])
  const ties = new Map([['d',-10],['c',-10],['b',10],['a',10]])
  assert.deepEqual(settleNetBalances(ties),[{from:'c',to:'a',amount:10},{from:'d',to:'b',amount:10}])
})
