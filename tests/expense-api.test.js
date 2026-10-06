import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const directory = await mkdtemp(join(tmpdir(), 'kaki-expense-api-'))
const result = await build({ entryPoints: ['src/lib/kakiSplitApi.js'], bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'supabase-fixture', setup(builder) {
    builder.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'fixture', namespace: 'test' }))
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const supabase = { rpc: (...args) => globalThis.__expenseRpc(...args), from: () => { throw Error("Unexpected direct database write") } }' }))
  } }],
})
const file = join(directory, 'api.mjs')
await writeFile(file, result.outputFiles[0].text)
const { addExpense } = await import(pathToFileURL(file))
test.after(async () => { delete globalThis.__expenseRpc; await rm(directory, { recursive: true, force: true }) })

const input = { groupId: 'g', createdBy: 'a', requestId: '11111111-1111-1111-1111-111111111111', amount: 20,
  description: 'Taxi', category: 'transport', paidBy: 'a', splitMembers: ['a', 'b'], splitType: 'equal', currency: 'USD', baseCurrency: 'SGD',
  reviewedQuote: { fromCurrency: 'USD', toCurrency: 'SGD', rate: 1.234568, source: 'fixture', asOfDate: '2026-10-06' } }

test('the reviewed conversion is saved through one atomic RPC with reconciled shares', async () => {
  const calls = []
  globalThis.__expenseRpc = async (...args) => { calls.push(args); return { data: { id: 'e' }, error: null } }
  assert.deepEqual(await addExpense(input), { id: 'e' })
  assert.equal(calls.length, 1)
  const [name, payload] = calls[0]
  assert.equal(name, 'create_group_expense')
  assert.equal(payload.p_request_id, input.requestId)
  assert.equal(payload.p_expense.exchange_rate, input.reviewedQuote.rate)
  assert.equal(payload.p_expense.exchange_rate_date, input.reviewedQuote.asOfDate)
  assert.equal(payload.p_expense.amount, 24.69)
  assert.equal(Math.round(payload.p_splits.reduce((sum, split) => sum + split.amount, 0) * 100), 2469)
  await addExpense({ ...input, amount: 1, reviewedQuote: { ...input.reviewedQuote, rate: 1.005 } })
  assert.equal(calls[1][1].p_expense.amount, 1.01)
})

test('database rejection permits corrections while an uncertain response keeps the request', async () => {
  globalThis.__expenseRpc = async () => ({ error: { code: 'P0001', message: 'Choose current group members' } })
  await assert.rejects(addExpense(input), error => error.definitelyRejected === true)
  globalThis.__expenseRpc = async () => ({ error: { code: '', message: 'Network failed' } })
  await assert.rejects(addExpense(input), error => error.definitelyRejected === false)
})


test('a mismatched reviewed quote cannot silently fetch a replacement and change the saved total', async () => {
  globalThis.__expenseRpc = async () => { throw Error('Should not send mismatched quote') }
  await assert.rejects(addExpense({ ...input, reviewedQuote: { ...input.reviewedQuote, fromCurrency: 'THB' } }), error => error.definitelyRejected && /different currency/.test(error.message))
})
