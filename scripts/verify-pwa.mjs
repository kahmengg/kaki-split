import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Verify the generated artifacts that phones actually receive, not just config.
const manifest = JSON.parse(readFileSync(new URL('../dist/manifest.webmanifest', import.meta.url), 'utf8'))
assert.equal(manifest.name, 'Kaki Split')
assert.equal(manifest.display, 'standalone')
assert.equal(manifest.start_url, '/')
assert.equal(manifest.scope, '/')
for (const size of [192, 512]) {
  const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}` && icon.purpose === 'any')
  assert.ok(icon, `Missing ${size}px install icon`)
  const png = readFileSync(new URL(`../dist${icon.src}`, import.meta.url))
  assert.equal(png.readUInt32BE(16), size)
  assert.equal(png.readUInt32BE(20), size)
}
assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'))
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
assert.match(html, /rel="manifest"/)
assert.match(html, /rel="apple-touch-icon"/)
assert.doesNotMatch(html, /favicon\.svg/)
const worker = readFileSync(new URL('../dist/sw.js', import.meta.url), 'utf8')
// Updates wait for an explicit user action, rather than interrupting expense entry.
assert.doesNotMatch(worker, /self\.skipWaiting\(\);/)
assert.match(worker, /SKIP_WAITING/)
assert.match(worker, /\.clientsClaim\(\)/)
console.log('PWA artifacts verified: standalone manifest, icon sizes, Apple icon, and prompted updates.')
