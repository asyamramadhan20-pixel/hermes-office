/**
 * Redaksi metadata sebelum disimpan ke `task_events` / ditampilkan.
 * Hermes sudah meredaksi sebagian (forced secret redaction), ini lapisan kedua.
 */
const POLA_RAHASIA = [
  /(sk|rk|pk|ghp|gho|xox[bap])[-_][A-Za-z0-9_\-]{16,}/g,
  /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*["']?[^\s"',}]{6,}/gi,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g
]
const KUNCI_SENSITIF = /^(api[_-]?key|token|secret|password|authorization|cookie|credential|env)$/i

export function redaksiTeks(teks: string, maks = 2000) {
  let t = teks
  for (const p of POLA_RAHASIA) t = t.replace(p, '[diredaksi]')
  return t.length > maks ? `${t.slice(0, maks)}… [dipotong]` : t
}

export function redaksiObjek(nilai: unknown, kedalaman = 0): unknown {
  if (kedalaman > 6) return '[terlalu dalam]'
  if (typeof nilai === 'string') return redaksiTeks(nilai)
  if (Array.isArray(nilai)) return nilai.slice(0, 50).map(v => redaksiObjek(v, kedalaman + 1))
  if (nilai && typeof nilai === 'object') {
    const hasil: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(nilai as Record<string, unknown>)) {
      hasil[k] = KUNCI_SENSITIF.test(k) ? '[diredaksi]' : redaksiObjek(v, kedalaman + 1)
    }
    return hasil
  }
  return nilai
}
