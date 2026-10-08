/**
 * Runner test e2e: migrasi DB test → bangun (bila perlu) → jalankan server → node --test → matikan.
 * Butuh DATABASE_URL_TEST (Postgres lokal). Pakai `--no-build` untuk memakai .output yang ada.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const DB = process.env.DATABASE_URL_TEST
if (!DB) { console.error('DATABASE_URL_TEST belum diset'); process.exit(1) }
const PORT = process.env.TEST_PORT || '3101'
const env = {
  ...process.env, DATABASE_URL: DB, NUXT_PUBLIC_APP_URL: `http://127.0.0.1:${PORT}`, PORT, HOST: '127.0.0.1',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || randomBytes(32).toString('base64'),
  NUXT_SESSION_PASSWORD: process.env.NUXT_SESSION_PASSWORD || randomBytes(32).toString('base64'),
  OFFICE_WORKER_NONAKTIF: '1', NUXT_PUBLIC_OFFICE_MODE: 'live', NODE_ENV: 'production'
}

const jalan = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { stdio: 'inherit', env, ...opts }); if (r.status !== 0) process.exit(r.status ?? 1) }

// Reset skema test supaya setiap run bersih.
jalan('psql', [DB, '-q', '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;'])
jalan('node', ['scripts/migrate.mjs'])
if (!process.argv.includes('--no-build') || !existsSync('.output/server/index.mjs')) jalan('npx', ['nuxt', 'build'])

const server = spawn('node', ['.output/server/index.mjs'], { env, stdio: ['ignore', 'pipe', 'inherit'] })
server.stdout.on('data', d => { if (process.env.TEST_VERBOSE) process.stdout.write(d) })
const base = `http://127.0.0.1:${PORT}`
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`${base}/api/health`); if (r.ok) break } catch {}
  await new Promise(r => setTimeout(r, 500))
}
const r = spawnSync('node', ['--test', 'test/e2e.test.mjs'], { stdio: 'inherit', env: { ...env, TEST_BASE_URL: base } })
server.kill('SIGTERM')
process.exit(r.status ?? 1)
