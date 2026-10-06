export const expenseRequestKey = ({ userId, groupId }) => userId && groupId ? `kaki:expense-request:v1:${userId}:${groupId}` : null

export function readExpenseRequest(scope, storage = undefined) {
  try {
    const key = expenseRequestKey(scope)
    const raw = key && (storage ?? globalThis.localStorage)?.getItem(key)
    if (!raw || raw.length > 250000) return null
    const request = JSON.parse(raw)
    if (!/^[a-f0-9-]{36}$/i.test(request?.requestId) || !Number.isFinite(request.amount) || request.amount <= 0 ||
      typeof request.description !== 'string' || typeof request.currency !== 'string' || typeof request.paid_by !== 'string' ||
      !Array.isArray(request.split_members) || !request.split_members.every(id => typeof id === 'string') ||
      !request.split_values || typeof request.split_values !== 'object') return null
    return request
  } catch { return null }
}

export function rememberExpenseRequest(scope, request, storage = undefined) {
  const key = expenseRequestKey(scope)
  if (!key) return false
  // Store before sending; an uncertain response must retain its exact quote and UUID.
  try { (storage ?? globalThis.localStorage).setItem(key, JSON.stringify(request)); return true } catch { return false }
}

export function forgetExpenseRequest(scope, storage = undefined) {
  try { const key = expenseRequestKey(scope); if (key) (storage ?? globalThis.localStorage)?.removeItem(key) } catch { /* Keep entry usable without storage. */ }
}

export function requestToDraft(request) {
  if (!request) return null
  return { amount: String(request.amount), description: request.description, currency: request.currency,
    category: request.category, paidBy: request.paid_by, splitMembers: request.split_members,
    splitType: request.split_type, splitValues: request.split_values }
}
