function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

export function computeNetBalances({ memberIds, expenses, splitsByExpenseId, payments }) {
  const net = new Map(memberIds.map(id => [id, 0]))

  for (const expense of expenses) {
    const amount = Number(expense.amount || 0)
    net.set(expense.paid_by, round2((net.get(expense.paid_by) || 0) + amount))

    const splits = splitsByExpenseId.get(expense.id) || []
    const uniqueSplitsByUser = new Map()

    for (const split of splits) {
      if (!uniqueSplitsByUser.has(split.user_id)) {
        uniqueSplitsByUser.set(split.user_id, Number(split.amount || 0))
      }
    }

    for (const [splitUserId, share] of uniqueSplitsByUser.entries()) {
      net.set(splitUserId, round2((net.get(splitUserId) || 0) - share))
    }
  }

  for (const payment of payments) {
    if (payment.voided_at) continue
    const amount = Number(payment.amount || 0)
    net.set(payment.from_user_id, round2((net.get(payment.from_user_id) || 0) + amount))
    net.set(payment.to_user_id, round2((net.get(payment.to_user_id) || 0) - amount))
  }

  return net
}

export function settleNetBalances(net) {
  const creditors = []
  const debtors = []

  for (const [userId, amount] of net.entries()) {
    if (amount > 0.009) creditors.push({ userId, amount: round2(amount) })
    if (amount < -0.009) debtors.push({ userId, amount: round2(Math.abs(amount)) })
  }

  const order = (a, b) => b.amount - a.amount || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
  creditors.sort(order)
  debtors.sort(order)

  const flows = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = round2(Math.min(debtor.amount, creditor.amount))

    if (amount > 0) {
      flows.push({ from: debtor.userId, to: creditor.userId, amount })
    }

    debtor.amount = round2(debtor.amount - amount)
    creditor.amount = round2(creditor.amount - amount)

    if (debtor.amount <= 0.009) i += 1
    if (creditor.amount <= 0.009) j += 1
  }

  return flows
}
