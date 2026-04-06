import { GoogleGenerativeAI } from '@google/generative-ai'

function parseJsonFromModelText(text) {
  const raw = String(text || '').trim()
  if (!raw) throw new Error('empty_response')

  const codeFenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = (codeFenceMatch?.[1] || raw).trim()

  const firstBrace = candidate.indexOf('{')
  const lastBrace = candidate.lastIndexOf('}')
  const jsonLike = firstBrace >= 0 && lastBrace > firstBrace ? candidate.slice(firstBrace, lastBrace + 1) : candidate

  return JSON.parse(jsonLike)
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'missing_gemini_api_key' })
    return
  }

  const imageBase64 = String(req.body?.imageBase64 || '').trim()
  const mimeType = String(req.body?.mimeType || 'image/jpeg').trim()

  if (!imageBase64) {
    res.status(400).json({ error: 'image_required' })
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
- tax and service_charge are separate from items — do not include them in the items array.
- total should be the final amount paid including tax and service charge.
- If you cannot read the receipt clearly, return { "error": "unreadable" }`

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
    ])

    const text = result.response.text()
    const parsed = parseJsonFromModelText(text)
    const normalized = normalizeReceipt(parsed)

    if (normalized.error) {
      res.status(200).json(normalized)
      return
    }

    if (!Number.isFinite(normalized.total) || normalized.total <= 0) {
      res.status(200).json({ error: 'unreadable' })
      return
    }

    res.status(200).json(normalized)
  } catch (error) {
    console.error('Receipt scan error:', error)
    res.status(500).json({ error: 'parse_failed' })
  }
}
