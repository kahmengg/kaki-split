import { queueDailyTelegramReminders, processTelegramOutbox } from '../_lib/telegram.js'

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    res.status(500).json({ error: 'Missing TELEGRAM_BOT_TOKEN' })
    return
  }

  try {
    const queued = await queueDailyTelegramReminders({ now: new Date() })
    const dispatched = await processTelegramOutbox({ botToken: token })

    res.status(200).json({
      ok: true,
      queued,
      dispatched,
    })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Daily telegram job failed' })
  }
}
