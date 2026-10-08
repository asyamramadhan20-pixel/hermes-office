/**
 * Tata letak & warna kantor 3D. Semua koordinat dunia (x kanan, z ke arah kamera).
 * Denah: baris belakang = Ruang Meeting (kiri) · HQ supervisor (tengah) · Lab/ruang server (kanan);
 *        baris tengah  = pod departemen berjajar;  baris depan = Lounge (kiri) · Pantry (kanan).
 * Status visual SELALU dari data (runAktif, status tugas, event), bukan acak.
 */
export interface WarnaDept { lantai: string, aksen: string, badan: string }
export type Titik = [number, number, number]

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
export const WARNA_PERINGATAN = '#F59E0B'

export function warnaDept(nama: string, gelap: boolean) {
  const peta = gelap ? WARNA_DEPT_GELAP : WARNA_DEPT
  return peta[nama] ?? peta.Umum!
}

/** Ukuran lantai kantor. */
export const LANTAI = { lebar: 36, dalam: 26 }

/** Posisi ruangan tetap (dunia). */
export const RUANG = {
  hq: [0, 0, -7.8] as Titik,
  meeting: [-11, 0, -7.6] as Titik,
  lab: [11, 0, -7.6] as Titik,
  lounge: [-11.5, 0, 7.6] as Titik,
  pantry: [11.5, 0, 7.6] as Titik
}

/** Titik tujuan karakter (dunia). */
export const TITIK = {
  /** depan HQ, tempat supervisor "mendelegasikan" */
  hqDepan: [0, 0, -4.9] as Titik,
  /** kursi ruang meeting (dipakai yang menunggu persetujuan) */
  meetingKursi: [[-12.7, 0, -8.5], [-11, 0, -8.5], [-9.3, 0, -8.5], [-12.7, 0, -6.7], [-11, 0, -6.7], [-9.3, 0, -6.7]] as Titik[],
  /** posisi asisten subagent di lab */
  labMeja: [[9.7, 0, -8.2], [11, 0, -8.2], [12.3, 0, -8.2], [9.7, 0, -6.6], [11, 0, -6.6], [12.3, 0, -6.6]] as Titik[],
  /** titik santai di lounge */
  lounge: [[-12.9, 0, 7.3], [-11.4, 0, 8.5], [-10.1, 0, 7.1]] as Titik[],
  /** titik di pantry */
  pantry: [[10.3, 0, 7.1], [11.7, 0, 8.5], [12.9, 0, 7.3]] as Titik[]
}

/** Ukuran ruangan divisi berdasarkan jumlah orang (maks 3 meja per baris). */
export function ukuranRuangDivisi(jumlah: number, n: number) {
  const kolom = Math.min(Math.max(jumlah, 1), 3)
  const baris = Math.max(1, Math.ceil(jumlah / 3))
  const maksLebar = Math.min(8.2, (LANTAI.lebar - 2 - (n - 1) * 1.0) / Math.max(n, 1))
  return { lebar: Math.min(maksLebar, Math.max(5.6, kolom * 2.0 + 1.6)), dalam: 4.6 + (baris - 1) * 1.6, kolom, baris }
}

/** Posisi ruangan divisi ke-i dari n: berjajar di baris tengah, rapat dengan celah 1 unit. */
export function posisiZona(i: number, n: number, lebarTiap: number[]): Titik {
  const total = lebarTiap.reduce((a, b) => a + b, 0) + (n - 1) * 1.0
  let x = -total / 2
  for (let k = 0; k < i; k++) x += (lebarTiap[k] ?? 0) + 1.0
  x += (lebarTiap[i] ?? 0) / 2
  return [x, 0, 0.6]
}

/** Posisi karakter ke-j di dalam ruangan (meja ada 0.75 di depannya ke arah dinding belakang). */
export function posisiKaryawan(j: number, total: number, dalam = 4.6): Titik {
  const kolom = Math.min(total, 3)
  const c = j % 3, r = Math.floor(j / 3)
  return [(c - (kolom - 1) / 2) * 2.0, 0, -dalam / 2 + 1.75 + r * 1.6]
}

export const kurang = (a: Titik, b: Titik): Titik => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const tambah = (a: Titik, b: Titik): Titik => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
