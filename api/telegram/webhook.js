import { handleTelegramWebhook } from '../_lib/telegram.js'

function isAuthorizedWebhookRequest(req) {
  const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim()
  if (!secret) return false
  const headerSecret = String(req.headers['x-telegram-bot-api-secret-token'] || '').trim()
  return headerSecret === secret
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(503).json({ error: 'TELEGRAM_WEBHOOK_SECRET is not configured' })
    return
  }

  if (!isAuthorizedWebhookRequest(req)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    res.status(500).json({ error: 'Missing TELEGRAM_BOT_TOKEN' })
    return
  }

  try {
    const result = await handleTelegramWebhook({ botToken: token, update: req.body })
    res.status(200).json({ ok: true, result })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Webhook processing failed' })
  }
}
