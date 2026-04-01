import { queueDailyTelegramReminders } from '../_lib/telegram.js'

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const result = await queueDailyTelegramReminders({ now: new Date() })
    res.status(200).json({ ok: true, ...result })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Reminder queueing failed' })
  }
}
