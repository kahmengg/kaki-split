function crc16(str) {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
    crc &= 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function tlv(tag, value) {
  return `${tag}${String(value.length).padStart(2, '0')}${value}`
}

export function normalizePayNowProxy(raw) {
  if (!raw) return null
  const cleaned = String(raw).replace(/\s+/g, '').replace(/-/g, '')
  if (/^\+65\d{8}$/.test(cleaned)) return cleaned
  if (/^65\d{8}$/.test(cleaned)) return `+${cleaned}`
  if (/^\d{8}$/.test(cleaned)) return `+65${cleaned}`
  return cleaned
}

export function buildPayNowPayload({ proxy, amount, editable = false, reference = '' }) {
  const normalized = normalizePayNowProxy(proxy)
  if (!normalized) return null

  const isUEN = !/^\+65\d{8}$/.test(normalized)
  const proxyType = isUEN ? '2' : '0'

  const merchantInfo = [
    tlv('00', 'SG.PAYNOW'),
    tlv('01', proxyType),
    tlv('02', normalized),
    tlv('03', editable ? '1' : '0'),
  ].join('')

  let payload = ''
  payload += tlv('00', '01')
  payload += tlv('01', '12')
  payload += tlv('26', merchantInfo)
  payload += tlv('52', '0000')
  payload += tlv('53', '702')

  if (amount != null && !editable) {
    const amountStr = Number(amount).toFixed(2)
    payload += tlv('54', amountStr)
  }

  payload += tlv('58', 'SG')
  payload += tlv('59', 'NA')
  payload += tlv('60', 'Singapore')

  if (reference) {
    const addData = tlv('05', reference)
    payload += tlv('62', addData)
  }

  payload += '6304'
  payload += crc16(payload)

  return payload
}

export function buildPayLahDeepLink({ proxy, amount, name }) {
  const params = new URLSearchParams()
  if (proxy) params.set('to', normalizePayNowProxy(proxy) || proxy)
  if (amount != null) params.set('amount', Number(amount).toFixed(2))
  if (name) params.set('memo', `Pay ${name}`)
  const qs = params.toString()
  return `dbspaylah://pay${qs ? `?${qs}` : ''}`
}
