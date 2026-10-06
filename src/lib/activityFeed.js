export function activityLabel(event) {
  const description = event.payload?.description || 'Expense'
  switch (event.event_type) {
    case 'expense_added': return `Added expense: ${description}`
    case 'expense_updated': return `Corrected expense: ${description}`
    case 'expense_deleted': return `Deleted expense: ${description}`
    case 'payment_deleted': return 'Deleted payment record'
    case 'payment_voided': return 'Voided payment record'
    case 'payment_acknowledged': return 'Acknowledged payment receipt'
    case 'payment_recorded': return 'Recorded payment'
    default: return 'Group update'
  }
}

export function activityRows(pages = []) {
  // Live refreshes and older pages can overlap. Keep each event exactly once.
  return [...new Map(pages.flatMap(page => page.rows).map(row => [row.id, row])).values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
}
