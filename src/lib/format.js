export const CATEGORIES = [
  { id: 'food', icon: '🍜', label: 'Food' },
  { id: 'transport', icon: '🚗', label: 'Transport' },
  { id: 'accommodation', icon: '🏠', label: 'Stay' },
  { id: 'activities', icon: '🏄', label: 'Activities' },
  { id: 'other', icon: '📦', label: 'Other' },
]

export const CURRENCIES = [
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
]

export function formatMoney(amount, currency = 'SGD') {
  return `${currency} ${Number(amount || 0).toFixed(2)}`
}

export function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now - date) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`

  return date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

export function getCategoryIcon(category) {
  return CATEGORIES.find(c => c.id === category)?.icon || '📦'
}

export function getUserInitials(user) {
  if (!user) return '?'
  const label = user.display_name || user.name || user.email || 'U'
  return label.slice(0, 2).toUpperCase()
}
