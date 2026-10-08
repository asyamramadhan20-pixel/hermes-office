import { createCipheriv, createDecipheriv, createHmac, randomBytes, createHash } from 'node:crypto'

/**
 * Enkripsi kredensial integrasi dengan AES-256-GCM.
 *
 * Format tersimpan: base64(iv) . base64(authTag) . base64(ciphertext)
 * GCM dipilih karena authenticated: ciphertext yang diubah-ubah akan ditolak saat
 * dekripsi, bukan menghasilkan sampah yang diam-diam dipakai.
 */
function ambilKunci() {
  const b64 = useRuntimeConfig().encryptionKey
  if (!b64) {
    throw createError({ statusCode: 500, statusMessage: 'ENCRYPTION_KEY belum diset' })
  }
  const kunci = Buffer.from(b64, 'base64')
  if (kunci.length !== 32) {
    throw createError({
      statusCode: 500,
      statusMessage: 'ENCRYPTION_KEY harus 32 byte (base64). Buat dengan: openssl rand -base64 32'
    })
  }
  return kunci
}

export function enkripsi(teks: string) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', ambilKunci(), iv)
  const enc = Buffer.concat([c.update(teks, 'utf8'), c.final()])
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.')
}

export function dekripsi(tersimpan: string) {
  const [ivB64, tagB64, dataB64] = tersimpan.split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw createError({ statusCode: 500, statusMessage: 'Ciphertext tidak berbentuk sah' })
  }
  const d = createDecipheriv('aes-256-gcm', ambilKunci(), Buffer.from(ivB64, 'base64'))
  d.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([d.update(Buffer.from(dataB64, 'base64')), d.final()]).toString('utf8')
}

/**
 * Bentuk tersamar yang aman ditampilkan di UI.
 * Menyisakan 3 karakter awal dan 4 akhir; kredensial pendek disamarkan seluruhnya
 * supaya tidak membocorkan proporsi yang berarti.
 */
export function samarkanRahasia(nilai: string) {
  const s = nilai.trim()
  if (s.length <= 10) return '•'.repeat(Math.max(s.length, 6))
  return `${s.slice(0, 3)}${'•'.repeat(5)}${s.slice(-4)}`
}

/** sha256 hex — dipakai untuk menyimpan token reset password. */
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')

/** Hash berkunci untuk pencarian persis (mis. nomor HP) tanpa menyimpan nilainya. */
export const hashPencarian = (nilai: string) => createHmac('sha256', ambilKunci()).update(nilai).digest('hex')
