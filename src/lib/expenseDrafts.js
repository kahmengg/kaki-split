const MAX_AGE = 30 * 86400000
const MAX_SIZE = 250000

// Account, group and edit revision prevent recovery into a different ledger context.
export function draftKey({ userId, groupId, expenseId = 'new', revision = 0 }) {
  return userId && groupId ? `kaki:expense-draft:v1:${userId}:${groupId}:${expenseId}:${revision}` : null
}

export function readDraft(scope, storage = undefined, now = Date.now()) {
  const key = draftKey(scope)
  if (!key) return null
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(key)
    if (!raw || raw.length > MAX_SIZE) return null
    const value = JSON.parse(raw)
    const draft = value.draft
    if (value.version !== 1 || !Number.isFinite(value.savedAt) || now - value.savedAt > MAX_AGE ||
      !draft || typeof draft.amount !== 'string' || typeof draft.description !== 'string' ||
      typeof draft.currency !== 'string' || !Array.isArray(draft.splitMembers) ||
      !draft.splitMembers.every(id => typeof id === 'string') ||
      !draft.splitValues || typeof draft.splitValues !== 'object' || Array.isArray(draft.splitValues) ||
      !Array.isArray(draft.sharedItems) || !draft.sharedItems.every(item => item && typeof item === 'object' &&
        Array.isArray(item.memberIds) && item.memberIds.every(id => typeof id === 'string'))) return null
    if (draft.receiptReview && (!draft.receiptReview.receipt || typeof draft.receiptReview.receipt !== 'object' ||
      !draft.receiptReview.assignments || typeof draft.receiptReview.assignments !== 'object' ||
      !Object.values(draft.receiptReview.assignments).every(ids => Array.isArray(ids) && ids.every(id => typeof id === 'string')))) return null
    return draft
  } catch { return null }
}

export function writeDraft(scope, draft, storage = undefined, now = Date.now()) {
  const key = draftKey(scope)
  if (!key) return false
  try {
    const raw = JSON.stringify({ version: 1, savedAt: now, draft })
    if (raw.length > MAX_SIZE) return false
    const target = storage ?? globalThis.localStorage
    target.setItem(key, raw)
    return true
  } catch { return false }
}

export function clearDraft(scope, storage = undefined) {
  try { const key = draftKey(scope); if (key) (storage ?? globalThis.localStorage)?.removeItem(key) } catch { /* Storage may be disabled. */ }
}
