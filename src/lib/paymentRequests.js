export const paymentRequestKey = ({ createdBy, groupId, fromUserId, toUserId }) => `kakisplit:payment-request:${createdBy}:${groupId}:${fromUserId}:${toUserId}`

export function readPaymentRequest(scope, storage = localStorage) {
  try {
    const request = JSON.parse(storage.getItem(paymentRequestKey(scope)))
    if (!request || !Object.keys(scope).every(key => request[key] === scope[key]) || !/^[a-f0-9-]{36}$/i.test(request.requestId) || !Number.isFinite(request.amount) || request.amount <= 0 || !Number.isSafeInteger(request.expectedRevision)) return null
    return request
  } catch { return null }
}

export function rememberPaymentRequest(request, storage = localStorage) {
  // Retain the exact attempted payload until the server confirms its result.
  storage.setItem(paymentRequestKey(request), JSON.stringify(request))
}

export function forgetPaymentRequest(scope, storage = localStorage) {
  storage.removeItem(paymentRequestKey(scope))
}
