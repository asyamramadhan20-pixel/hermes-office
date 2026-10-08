/**
 * Tata letak & warna kantor 3D. Posisi departemen di ring sekeliling gedung pusat.
 * Semua status visual berasal dari data (runAktif, isActive), bukan animasi acak.
 */
export interface WarnaDept { lantai: string, aksen: string, badan: string }

export const WARNA_DEPT: Record<string, WarnaDept> = {
  Manajemen: { lantai: '#DCE3F5', aksen: '#6F63EA', badan: '#6F63EA' },
  Iklan: { lantai: '#FBE3DD', aksen: '#E8603C', badan: '#E8603C' },
  CS: { lantai: '#FADDEC', aksen: '#D94C8F', badan: '#D94C8F' },
  Keuangan: { lantai: '#DDF2E6', aksen: '#2E9E6B', badan: '#2E9E6B' },
  Operasional: { lantai: '#FDEEDA', aksen: '#E39B2C', badan: '#E39B2C' },
  Umum: { lantai: '#E6E9EF', aksen: '#667084', badan: '#667084' }
}
export const WARNA_DEPT_GELAP: Record<string, WarnaDept> = {
  Manajemen: { lantai: '#2A2F4A', aksen: '#A099F6', badan: '#8C83F5' },
  Iklan: { lantai: '#4A2A24', aksen: '#F0876A', badan: '#E8603C' },
  CS: { lantai: '#48263A', aksen: '#EC7FB5', badan: '#D94C8F' },
  Keuangan: { lantai: '#213D2F', aksen: '#5CC392', badan: '#2E9E6B' },
  Operasional: { lantai: '#4A3A1F', aksen: '#F2B85A', badan: '#E39B2C' },
  Umum: { lantai: '#2A2F3A', aksen: '#9AA3B5', badan: '#667084' }
}
export const WARNA_AKTIF = '#22D3EE' // cyan: HANYA untuk run berjalan

export function warnaDept(nama: string, gelap: boolean) {
  const peta = gelap ? WARNA_DEPT_GELAP : WARNA_DEPT
  return peta[nama] ?? peta.Umum!
}

/** Posisi zona ke-i dari n zona, di ring radius r (gedung pusat di belakang, z negatif). */
export function posisiZona(i: number, n: number, r = 6.6): [number, number, number] {
  // Sebar di busur depan (kiri → kanan) supaya semua terlihat dari kamera isometrik; zona tengah agak maju.
  const awal = Math.PI * 0.08, akhir = Math.PI * 0.92
  const t = n <= 1 ? 0.5 : i / (n - 1)
  const sudut = awal + (akhir - awal) * t
  return [Math.cos(sudut) * r, 0, Math.sin(sudut) * r * 0.55 + 0.4]
}

/** Posisi karakter ke-j di dalam zona (di depan meja). */
export function posisiKaryawan(j: number, total: number): [number, number, number] {
  const lebar = Math.min(total, 3)
  const kolom = j % 3, baris = Math.floor(j / 3)
  return [(kolom - (lebar - 1) / 2) * 1.15, 0, 0.55 + baris * 1.1]
}
