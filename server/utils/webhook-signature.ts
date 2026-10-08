import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Tanda tangan outbound webhook Hermes Agent (agent/outbound_webhooks.py upstream):
 *   X-Hermes-Signature-256: sha256=<hex HMAC-SHA256(raw body, secret)>
 * `delivery_id` dan `timestamp` (ISO UTC) ada DI DALAM body yang ditandatangani,
 * jadi dedupe + jendela waktu memberi perlindungan replay.
 */
export function hitungSignatureHermes(secret: string, rawBody: string | Buffer) {
  return 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
}

export function signatureCocok(diharapkan: string, diterima: string) {
  const a = Buffer.from(diharapkan, 'utf8')
  const b = Buffer.from(diterima, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export const TOLERANSI_UMUR_MS = 5 * 60 * 1000

/** `timestamp` ISO-8601 dari body Hermes. Toleransi ±5 menit. */
export function timestampMasihSegar(timestampIso: string, sekarang = Date.now()) {
  const t = Date.parse(timestampIso)
  if (!Number.isFinite(t)) return false
  const selisih = sekarang - t
  return selisih <= TOLERANSI_UMUR_MS && selisih >= -TOLERANSI_UMUR_MS
}
