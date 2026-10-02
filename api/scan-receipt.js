import { GoogleGenerativeAI } from '@google/generative-ai'
import { adminSupabase } from './_lib/db.js'

const RECEIPT_MODEL = process.env.GEMINI_RECEIPT_MODEL || 'gemini-3.1-flash-lite'

function parseJsonFromModelText(text) {
  const raw = String(text || '').trim()
  if (!raw) throw new Error('empty_response')

  const codeFenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = (codeFenceMatch?.[1] || raw).trim()

  try {
    return JSON.parse(candidate)
  } catch {
    const firstBrace = candidate.indexOf('{')
    const lastBrace = candidate.lastIndexOf('}')
    const jsonLike =
      firstBrace >= 0 && lastBrace > firstBrace
        ? candidate.slice(firstBrace, lastBrace + 1)
        : candidate

    return JSON.parse(jsonLike)
  }
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function normalizeCurrency(value) {
  const upper = String(value || '').trim().toUpperCase()
  if (['SGD', 'MYR', 'IDR', 'THB'].includes(upper)) return upper
  return 'SGD'
}

function normalizeReceipt(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid_payload')
  if (parsed.error) return { error: String(parsed.error) }

  const items = Array.isArray(parsed.items)
    ? parsed.items
        .map((item, index) => ({
          id: String(item?.id || index + 1),
          name: String(item?.name || '').trim(),
          amount: round2(item?.amount),
          quantity: Number(item?.quantity || 1),
        }))
        .filter((item) => item.name && Number.isFinite(item.amount) && item.amount > 0)
    : []

  return {
    merchant: String(parsed.merchant || 'Receipt').trim() || 'Receipt',
    total: round2(parsed.total),
    currency: normalizeCurrency(parsed.currency),
    date: String(parsed.date || '').trim() || null,
    items,
    tax: round2(parsed.tax),
    service_charge: round2(parsed.service_charge),
    discount: round2(parsed.discount),
  }
}

async function getAuthenticatedUser(req, supabaseClient) {
  const authHeader = String(req.headers?.authorization || '')
  const accessToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (!accessToken) return null

  const { data, error } = await supabaseClient.auth.getUser(accessToken)
  if (error || !data?.user || data.user.is_anonymous) return null

  return data.user
}

// Inject external clients for tests; production always uses the server credentials.
export function createReceiptScanHandler({
  supabaseClient = adminSupabase,
  createGenAI = (key) => new GoogleGenerativeAI(key),
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed' })
      return
    }

    let user
    try {
      user = await getAuthenticatedUser(req, supabaseClient)
    } catch {
      res.status(503).json({ error: 'scan_unavailable' })
      return
    }
    if (!user) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      res.status(500).json({ error: 'missing_gemini_api_key' })
      return
    }

    const imageBase64 = String(req.body?.imageBase64 || '').trim()
    const mimeType = String(req.body?.mimeType || 'image/jpeg').trim().toLowerCase()

    if (!imageBase64) {
      res.status(400).json({ error: 'image_required' })
      return
    }

    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
    if (!allowedMimeTypes.has(mimeType)) {
      res.status(400).json({ error: 'unsupported_mime_type' })
      return
    }

    // Leave room for JSON below Vercel's 4.5 MB request limit.
    const maxBase64Length = 4 * 1024 * 1024
    if (imageBase64.length > maxBase64Length) {
      res.status(413).json({ error: 'image_too_large' })
      return
    }

    // Canonical decoding rejects malformed input without a deeply repeating regex.
    if (Buffer.from(imageBase64, 'base64').toString('base64') !== imageBase64) {
      res.status(400).json({ error: 'invalid_image' })
      return
    }

    let quota
    try {
      // Identity comes from verified Auth, never from request.body.userId.
      const { data, error } = await supabaseClient.rpc('reserve_receipt_scan', { p_user_id: user.id })
      const reservation = data?.[0]
      if (error || !reservation || typeof reservation.allowed !== 'boolean' ||
        !Number.isInteger(reservation.remaining) || reservation.remaining < 0 || reservation.remaining > 4 ||
        !Number.isFinite(Date.parse(reservation.resets_at))) throw new Error('quota_unavailable')
      quota = { limit: 5, remaining: reservation.remaining, resetsAt: reservation.resets_at }
      if (!reservation.allowed) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((Date.parse(quota.resetsAt) - Date.now()) / 1000))))
        res.status(429).json({ error: 'daily_scan_limit_reached', quota })
        return
      }
    } catch {
      // Fail closed: database outages must never grant free provider calls.
      res.status(503).json({ error: 'scan_unavailable' })
      return
    }

    const prompt = `You are a receipt parser for a bill-splitting app used in Southeast Asia.

Analyze this receipt image and extract the data. Return ONLY a valid JSON object with no markdown, no explanation, no backticks.

Return this exact shape:
{
  "merchant": "Restaurant or store name",
  "total": 14.72,
  "currency": "SGD",
  "date": "2024-05-01",
  "items": [
    { "id": "1", "name": "Item name", "amount": 6.50, "quantity": 1 }
  ],
  "tax": 1.22,
  "service_charge": 0.00,
  "discount": 0.00
}

Rules:
- currency must be SGD, MYR, IDR, or THB based on receipt clues. Default to SGD.
- If an item has no clear price, omit it.
- tax and service_charge are separate from items - do not include them in the items array.
- total should be the final amount paid including tax and service charge.
- If you cannot read the receipt clearly, return { "error": "unreadable" }
- Do not include trailing commas in JSON.
- Do not include comments in JSON.`

    try {
      const genAI = createGenAI(apiKey)
      // One reservation permits one call; failures keep their consumed attempt.
      const model = genAI.getGenerativeModel({ model: RECEIPT_MODEL })
      const result = await model.generateContent([
        {
          text: prompt,
        },
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ], { timeout: 25000 })

      const text = result.response.text()
      const parsed = parseJsonFromModelText(text)
      const normalized = normalizeReceipt(parsed)

      if (normalized.error) {
        res.status(200).json({ ...normalized, quota })
        return
      }

      if (!Number.isFinite(normalized.total) || normalized.total <= 0) {
        res.status(200).json({ error: 'unreadable', quota })
        return
      }

      res.status(200).json({ ...normalized, quota })
      return
    } catch {
      // Do not log receipt contents or expose provider/key details to clients.
      console.error('Receipt scan failed')
      res.status(500).json({
        error: 'parse_failed',
        quota,
      })
    }
  }
}

export default createReceiptScanHandler()
