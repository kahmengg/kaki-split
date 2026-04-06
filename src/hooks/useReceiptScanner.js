import { useState } from 'react'

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
        throw new Error(data?.error || 'scan_failed')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'scan_failed'
      setError(message)
      return null
    } finally {
      setScanning(false)
    }
  }

  return { scanReceipt, scanning, error, setError }
}
