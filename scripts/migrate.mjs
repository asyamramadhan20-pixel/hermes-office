/**
 * Menjalankan migrasi Drizzle saat rilis (Railway `preDeployCommand`).
 *
 * Sengaja TIDAK memakai CLI `drizzle-kit`: paket itu ada di devDependencies dan
 * bisa hilang kalau build memangkas dev deps. Migrator di bawah berasal dari
 * `drizzle-orm` yang merupakan dependency produksi, jadi selalu tersedia.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL belum diset — migrasi dibatalkan.')
  process.exit(1)
}

// Jaringan privat Railway kadang belum bisa menerjemahkan nama database saat container baru menyala
// (EAI_AGAIN / ECONNREFUSED / ENOTFOUND / timeout). Menyerah langsung membuat aplikasi mati (crash-loop) walau
// database sehat, jadi galat jaringan dicoba lagi (jeda 5 dtk, sampai ±8 menit). Galat migrasi sungguhan tetap langsung gagal.
const GALAT_JARINGAN = /EAI_AGAIN|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|CONNECT_TIMEOUT|ECONNRESET|EHOSTUNREACH/
const MAKS_COBA = 96

for (let coba = 1; ; coba++) {
  // max: 1 — migrasi harus berurutan di satu koneksi.
  const sql = postgres(url, { max: 1, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require' })
  try {
    // Dua service (web + demo) berbagi satu Postgres dan preDeploy-nya jalan bersamaan: kunci advisory
    // (sesi, dilepas saat koneksi ditutup) supaya migrasi berjalan satu per satu, bukan tabrakan.
    await sql`select pg_advisory_lock(729173601)`
    await migrate(drizzle(sql), { migrationsFolder: './server/database/migrations' })
    await sql`select pg_advisory_unlock(729173601)`
    console.log('✓ Migrasi selesai.')
    await sql.end()
    break
  } catch (e) {
    const pesan = `${e.message} ${e.cause?.message ?? ''} ${e.code ?? ''} ${e.cause?.code ?? ''}`
    await sql.end({ timeout: 1 }).catch(() => {})
    if (GALAT_JARINGAN.test(pesan) && coba < MAKS_COBA) {
      console.error(`… database belum terjangkau (percobaan ${coba}/${MAKS_COBA}), coba lagi 5 detik:`, pesan.trim().slice(0, 140))
      await new Promise(r => setTimeout(r, 5000))
      continue
    }
    console.error('✗ Migrasi gagal:', e.message, e.cause?.message ?? '')
    process.exit(1)
  }
}
