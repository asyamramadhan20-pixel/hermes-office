/**
 * Tangkap layar Pusat Komando (desktop 1440x900 & mobile 390x844, terang & gelap).
 * Prasyarat: server dev berjalan di BASE_URL (default http://localhost:3000) dalam mode demo.
 *   NUXT_PUBLIC_OFFICE_MODE=demo npx nuxt dev --port 3000 &
 *   node scripts/screenshot.mjs
 */
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const TUJUAN = path.resolve('docs/design/screens')
const KANDIDAT = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.CHROME_PATH].filter(Boolean)
const executablePath = KANDIDAT.find(p => existsSync(p))
if (!executablePath) { console.error('Chromium tidak ditemukan di', KANDIDAT); process.exit(1) }

const VIEWPORT = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } }
/** Halaman yang ditangkap: nama file → { path, selector siap }. */
const HALAMAN = { 'pusat-komando': { path: '/', siap: '[data-testid="pusat-komando"]' }, kantor: { path: '/kantor', siap: '[data-testid="kantor-virtual"]' } }
const PILIH = (process.env.HALAMAN || Object.keys(HALAMAN).join(',')).split(',').filter(h => HALAMAN[h])

await mkdir(TUJUAN, { recursive: true })
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
try {
  for (const nama of PILIH) for (const [perangkat, viewport] of Object.entries(VIEWPORT)) {
    for (const mode of ['light', 'dark']) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: mode, locale: 'id-ID' })
      await context.addInitScript((m) => { try { localStorage.setItem('nuxt-color-mode', m) } catch {} }, mode)
      const page = await context.newPage()
      await page.goto(`${BASE_URL}${HALAMAN[nama].path}`, { waitUntil: 'networkidle', timeout: 120_000 })
      await page.waitForSelector(HALAMAN[nama].siap, { timeout: 60_000 })
      await page.waitForTimeout(nama === 'kantor' ? 4000 : 800)
      const file = path.join(TUJUAN, `${nama === 'pusat-komando' ? '' : nama + '-'}${perangkat}-${mode}.png`)
      await page.screenshot({ path: file, fullPage: true })
      console.log('tersimpan', file)
      await context.close()
    }
  }
} finally {
  await browser.close()
}
