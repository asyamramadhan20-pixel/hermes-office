# CI/CD

Workflow: `.github/workflows/ci-cd.yml`.

## CI (setiap push & pull request)
1. `npm ci`
2. `npm run typecheck`
3. `npm test` — membangun server, menjalankan migrasi ke Postgres 16 (service container), menyalakan server + Hermes tiruan
   (`test/fixtures/hermes-palsu.mjs`), lalu menjalankan `test/e2e.test.mjs` (isolasi tenant, HMAC/replay, alur tugas, cancel, approval, UNKNOWN).

PR tidak boleh di-merge kalau job `uji` merah. Aktifkan di GitHub: **Settings → Branches → Branch protection `main` → Require status checks: "Typecheck + test e2e"**.

## CD
Deploy dilakukan oleh **Railway auto-deploy dari GitHub** (service `hermes-office` terhubung ke repo, branch `main`):
setiap push ke `main` langsung di-build dan di-deploy oleh Railway. Supaya deploy menunggu CI hijau, nyalakan
**Railway → service → Settings → Source → "Wait for CI" (check suites)**. Tidak ada token Railway di GitHub.

## Variabel produksi
Diisi di Railway, bukan di GitHub: `DATABASE_URL`, `ENCRYPTION_KEY`, `NUXT_SESSION_PASSWORD`, `NUXT_PUBLIC_APP_URL`,
`NUXT_PUBLIC_OFFICE_MODE=live` (lihat `docs/deploy-railway.md`). Migrasi berjalan di `preDeployCommand`.
