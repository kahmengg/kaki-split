import test from 'node:test'
import assert from 'node:assert/strict'

// Dummy configuration lets the module load without reading real credentials.
process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only'
process.env.GEMINI_API_KEY = 'test-only'
const scanner = await import('../api/scan-receipt.js')

function setup({ quotaError = false, providerError = false, anonymous = false, unreadable = false, invalidToken = false } = {}) {
  let used = 0
  let providerCalls = 0
  let quotaCalls = 0
  const supabaseClient = {
    auth: { getUser: async () => ({ data: { user: invalidToken ? null : { id: 'verified-user', is_anonymous: anonymous } } }) },
    rpc: async (name, args) => {
      if (name === 'refund_receipt_scan') {
        assert.equal(args.p_user_id, 'verified-user')
        used = Math.max(0, used - 1)
        return { data: 5 - used }
      }
      assert.equal(name, 'reserve_receipt_scan')
      assert.deepEqual(args, { p_user_id: 'verified-user' })
      quotaCalls += 1
      if (quotaError) return { error: { message: 'database unavailable' } }
      // This stub models the atomic RPC contract; database checks verify SQL separately.
      const allowed = used < 5
      if (allowed) used += 1
      return { data: [{ allowed, remaining: 5 - used, resets_at: '2026-10-03T16:00:00Z' }] }
    },
  }
  const createGenAI = () => ({
    getGenerativeModel: () => ({ generateContent: async () => {
      providerCalls += 1
      if (providerError) throw new Error('provider failed')
      return { response: { text: () => JSON.stringify(unreadable ? { error: 'unreadable' } : { merchant: 'Test', total: 12, currency: 'SGD', items: [] }) } }
    } }),
  })
  assert.equal(typeof scanner.createReceiptScanHandler, 'function', 'scanner must expose the testable quota-enforcing handler')
  const handler = scanner.createReceiptScanHandler({ supabaseClient, createGenAI })
  async function request(body = { imageBase64: 'dGVzdA==', mimeType: 'image/jpeg' }, headers = { authorization: 'Bearer token' }) {
    const response = { headers: {}, setHeader(key, value) { this.headers[key] = value }, status(code) { this.code = code; return this }, json(value) { this.body = value } }
    await handler({ method: 'POST', headers, body }, response)
    return response
  }
  return { request, counts: () => ({ used, providerCalls, quotaCalls }) }
}

test('six simultaneous requests admit exactly five provider attempts', async () => {
  const app = setup()
  const responses = await Promise.all(Array.from({ length: 6 }, () => app.request()))
  assert.equal(responses.filter(r => r.code === 200).length, 5)
  const rejected = responses.find(r => r.code === 429)
  assert.equal(rejected.body.error, 'daily_scan_limit_reached')
  assert.equal(rejected.body.quota.remaining, 0)
  assert.ok(Number(rejected.headers['Retry-After']) > 0)
  assert.equal(app.counts().providerCalls, 5)
})

test('database errors fail closed without calling the provider', async () => {
  const app = setup({ quotaError: true })
  assert.equal((await app.request()).code, 503)
  assert.equal(app.counts().providerCalls, 0)
})

test('invalid images and missing authentication do not consume quota', async () => {
  const app = setup()
  assert.equal((await app.request({ imageBase64: '', mimeType: 'image/jpeg' })).code, 400)
  assert.equal((await app.request({ imageBase64: '%%%invalid', mimeType: 'image/jpeg' })).code, 400)
  assert.equal((await app.request({ imageBase64: 'dGVzdA==', mimeType: 'text/plain' })).code, 400)
  assert.equal((await app.request({ imageBase64: 'A'.repeat(4 * 1024 * 1024 + 4), mimeType: 'image/jpeg' })).code, 413)
  assert.equal((await app.request(undefined, {})).code, 401)
  assert.equal(app.counts().quotaCalls, 0)
})

test('invalid tokens cannot consume an allowance', async () => {
  const app = setup({ invalidToken: true })
  assert.equal((await app.request()).code, 401)
  assert.equal(app.counts().quotaCalls, 0)
})

test('unreadable receipts still consume an attempt', async () => {
  const app = setup({ unreadable: true })
  const response = await app.request()
  assert.equal(response.body.error, 'unreadable')
  assert.equal(response.body.quota.remaining, 4)
  assert.equal(app.counts().providerCalls, 1)
})

test('client-supplied identity cannot choose another account allowance', async () => {
  const app = setup()
  assert.equal((await app.request({ imageBase64: 'dGVzdA==', mimeType: 'image/jpeg', userId: 'someone-else' })).code, 200)
  // The RPC argument assertion in setup verifies the authenticated user is used.
  assert.equal(app.counts().quotaCalls, 1)
})

test('anonymous accounts cannot obtain a scan allowance', async () => {
  const app = setup({ anonymous: true })
  assert.equal((await app.request()).code, 401)
  assert.equal(app.counts().quotaCalls, 0)
})

test('provider failures return the allowance and never trigger fallback calls', async () => {
  const app = setup({ providerError: true })
  const response = await app.request()
  assert.equal(response.code, 500)
  assert.equal(response.body.quota.remaining, 5)
  assert.equal(response.body.details, undefined)
  assert.equal(app.counts().providerCalls, 1)
})
