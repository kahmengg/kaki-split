import { useState } from 'react'

function getReceiptScanMessage(code, details = '') {
  const normalizedCode = String(code || '').trim()
  const normalizedDetails = String(details || '').toLowerCase()

  if (normalizedDetails.includes('failed to fetch') || normalizedDetails.includes('network')) {
    return 'Receipt scanning could not connect. Check your connection and try again.'
  }

  const messages = {
    image_required: 'Choose a receipt image first.',
    unsupported_mime_type: 'Use a JPEG, PNG, or WebP receipt image.',
    image_too_large: 'This image is too large. Try a smaller photo or screenshot.',
    unreadable: "I couldn't read this receipt clearly. Try a sharper, well-lit photo with the full receipt visible.",
    parse_failed: "I couldn't extract receipt details from this image. Try a clearer photo, or enter the expense manually.",
    missing_gemini_api_key: 'Receipt scanning is not configured yet.',
  }

  return messages[normalizedCode] || "I couldn't scan this receipt. Try a clearer photo or enter it manually."
}

export function useReceiptScanner() {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)

  async function scanReceipt(file) {
    if (!file) return null

    setScanning(true)
    setError(null)

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const text = String(reader.result || '')
          const payload = text.includes(',') ? text.split(',')[1] : text
          resolve(payload)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type || 'image/jpeg',
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        // Keep server error codes internal and show people a useful next step.
        throw new Error(getReceiptScanMessage(data?.error, data?.details))
      }

      if (data?.error) {
        throw new Error(getReceiptScanMessage(data.error, data?.details))
      }

      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : getReceiptScanMessage('scan_failed')
      setError(message)
      return null
    } finally {
      setScanning(false)
    }
  }

  return { scanReceipt, scanning, error, setError }
}
