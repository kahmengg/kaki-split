import { queueDailyTelegramReminders, processTelegramOutbox } from '../_lib/telegram.js'


function resolveAction(req) {
  const queryAction = String(req.query?.action || '').trim().toLowerCase()
  const bodyAction = String(req.body?.action || '').trim().toLowerCase()
  const action = queryAction || bodyAction || 'daily'
  return action
}

export default async function handler(req, res) {
  const method = String(req.method || '').toUpperCase()
  if (method !== 'POST' && method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }


  const action = resolveAction(req)

  try {
    if (action === 'reminders') {
      const queued = await queueDailyTelegramReminders({ now: new Date() })
      res.status(200).json({ ok: true, action, ...queued })
      return
    }

    if (action === 'dispatch') {
      const token = process.env.TELEGRAM_BOT_TOKEN
      if (!token) {
        res.status(500).json({ error: 'Missing TELEGRAM_BOT_TOKEN' })
        return
      }
      const dispatched = await processTelegramOutbox({ botToken: token })
      res.status(200).json({ ok: true, action, ...dispatched })
      return
    }

    if (action === 'daily') {
      const token = process.env.TELEGRAM_BOT_TOKEN
      if (!token) {
        res.status(500).json({ error: 'Missing TELEGRAM_BOT_TOKEN' })
        return
      }
      const queued = await queueDailyTelegramReminders({ now: new Date() })
      const dispatched = await processTelegramOutbox({ botToken: token })
      res.status(200).json({ ok: true, action, queued, dispatched })
      return
    }

    res.status(400).json({
      error: 'Invalid action',
      allowedActions: ['daily', 'reminders', 'dispatch'],
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      action,
      error: error?.message || 'Telegram job failed',
    })
  }
}
