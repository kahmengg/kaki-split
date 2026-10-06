import { formatMoney } from './format.js'

export function recordedPeriod(expenses = []) {
  if (!expenses.length) return 'No expenses recorded yet'
  // Match the app's Singapore accounting day; this is a record period, not a trip date.
  const dates = expenses.filter(expense => expense.created_at).map(expense => new Date(expense.created_at)).filter(date => Number.isFinite(date.getTime())).sort((a, b) => a - b)
  if (!dates.length) return 'No dated expenses recorded yet'
  const format = date => date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' })
  const first = format(dates[0])
  const last = format(dates.at(-1))
  return first === last ? first : `${first} – ${last}`
}

export function summaryText(data) {
  if (!data?.group) return 'Trip summary from Kaki Split.'
  const count = data.expenses?.length || 0
  const members = data.members?.length || 0
  return `${data.group.name}\nTotal spent together: ${formatMoney(data.totalSpend, data.group.base_currency)}\nRecorded: ${recordedPeriod(data.expenses)}\n${count} expense${count === 1 ? '' : 's'} · ${members} member${members === 1 ? '' : 's'}\nShared with Kaki Split`
}
