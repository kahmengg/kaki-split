import { handleTelegramWebhook } from '../_lib/telegram.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
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
