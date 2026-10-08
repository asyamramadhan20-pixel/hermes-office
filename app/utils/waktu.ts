/** Utilitas waktu untuk tampilan. Zona tampilan = WIB (Asia/Jakarta). */

const ZONA = 'Asia/Jakarta'

/** "3 menit lalu", "2 jam lalu", "kemarin", "5 hari lalu". `sekarang` = acuan (default Date.now()). */
export function waktuRelatif(iso: string | null | undefined, sekarang: number = Date.now()): string {
  if (!iso) return 'belum pernah'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const detik = Math.round((sekarang - t) / 1000)
  if (detik < 45) return 'baru saja'
  const menit = Math.round(detik / 60)
  if (menit < 60) return `${menit} menit lalu`
  const jam = Math.round(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  const hari = Math.round(jam / 24)
  if (hari === 1) return 'kemarin'
  if (hari < 30) return `${hari} hari lalu`
  const bulan = Math.round(hari / 30)
  if (bulan < 12) return `${bulan} bulan lalu`
  return `${Math.round(bulan / 12)} tahun lalu`
}

/** "8 Okt 2026, 09.27 WIB" */
export function waktuLengkap(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const teks = new Intl.DateTimeFormat('id-ID', {
    timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(d)
  return `${teks} WIB`
}

/** "09.27" */
export function jamSaja(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' }).format(d)
}

export function angkaId(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n)
}
