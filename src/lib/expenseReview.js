const round2 = (value) => Math.round(Number(value) * 100) / 100

export function convertedExpenseAmount(originalAmount, currency, rate, savedExpense) {
  // Legacy stored rates may have lost precision; unchanged purchases keep their ledger total.
  if (savedExpense && currency === savedExpense.original_currency && originalAmount === Number(savedExpense.original_amount)) return Number(savedExpense.amount)
  if (!Number.isFinite(Number(originalAmount)) || !Number.isFinite(Number(rate))) return NaN
  // Integer cents and six-decimal rate units match Postgres rounding at half cents.
  const product = BigInt(Math.round(Number(originalAmount) * 100)) * BigInt(Math.round(Number(rate) * 1000000))
  const absolute = product < 0n ? -product : product
  const cents = (absolute + 500000n) / 1000000n
  return Number(product < 0n ? -cents : cents) / 100
}

export function summarizeExpenses(expenses) {
  const days = new Map()
  let topExpense = null
  for (const expense of expenses) {
    if (!topExpense || Number(expense.amount) > Number(topExpense.amount) ||
      (Number(expense.amount) === Number(topExpense.amount) && String(expense.created_at) > String(topExpense.created_at))) topExpense = expense
    const date = new Date(expense.created_at)
    if (!Number.isFinite(date.getTime())) continue
    // Use one explicit timezone so devices agree on the busiest calendar day.
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    days.set(day, (days.get(day) || 0) + 1)
  }
  const busiest = [...days].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]
  return { topExpense, mostActiveDay: busiest?.[0] || null, mostActiveDayCount: busiest?.[1] || 0 }
}

export function expenseToDraft(expense, baseCurrency) {
  const foreign = Number(expense.original_amount) > 0 && Number(expense.exchange_rate) > 0 && expense.original_currency !== baseCurrency
  const total = foreign ? Number(expense.original_amount) : Number(expense.amount)
  const allocations = (expense.splits || []).map((split) => ({ id: split.user_id, amount: round2(Number(split.amount) / (foreign ? Number(expense.exchange_rate) : 1)) }))
  // Recover original-currency cents without silently changing the total.
  if (allocations.length) {
    const largest = allocations.reduce((best, value, index) => value.amount > allocations[best].amount ? index : best, 0)
    allocations[largest].amount = round2(allocations[largest].amount + total - allocations.reduce((sum, value) => sum + value.amount, 0))
  }
  return {
    amount: String(total), description: expense.description, category: expense.category,
    paidBy: expense.paid_by, currency: foreign ? expense.original_currency : baseCurrency,
    // Stored percentage rows contain final amounts, not the entered percentages.
    splitType: expense.split_type === 'equal' ? 'equal' : 'exact',
    splitMembers: allocations.map((value) => value.id),
    splitValues: Object.fromEntries(allocations.map((value) => [value.id, value.amount.toFixed(2)])),
  }
}
