# CI/CD

Workflow: `.github/workflows/ci-cd.yml`.

## CI (setiap push & pull request)
1. `npm ci`
2. `npm run typecheck`
3. `npm test` — membangun server, menjalankan migrasi ke Postgres 16 (service container), menyalakan server + Hermes tiruan
   (`test/fixtures/hermes-palsu.mjs`), lalu menjalankan `test/e2e.test.mjs` (isolasi tenant, HMAC/replay, alur tugas, cancel, approval, UNKNOWN).

PR tidak boleh di-merge kalau job `uji` merah. Aktifkan di GitHub: **Settings → Branches → Branch protection `main` → Require status checks: "Typecheck + test e2e"**.

## CD (push ke `main`, hanya setelah CI hijau)
Job `deploy` menjalankan `railway up --service <nama> --detach` dengan token proyek.

Sekali jalan, di GitHub repo:
- **Settings → Secrets and variables → Actions → Secrets**: `RAILWAY_TOKEN` = *Project Token* dari Railway
  (Project → Settings → Tokens → Create). Token proyek hanya berlaku untuk proyek itu.
- **Variables** (opsional): `RAILWAY_SERVICE` = nama service di Railway bila bukan `hermes-office`.
- **Settings → Environments → production** (opsional): tambahkan *required reviewers* kalau deploy produksi mau pakai approval manual.

Di Railway, **matikan auto-deploy dari GitHub** untuk service ini (Service → Settings → Source → *Disable* automatic deployments)
supaya hanya pipeline yang men-deploy setelah test lolos. Alternatifnya tanpa job `deploy`: biarkan auto-deploy Railway aktif
dan nyalakan **"Wait for CI"** di pengaturan source Railway; Railway akan menunggu check GitHub hijau sebelum build.

## Variabel produksi
Diisi di Railway, bukan di GitHub: `DATABASE_URL`, `ENCRYPTION_KEY`, `NUXT_SESSION_PASSWORD`, `NUXT_PUBLIC_APP_URL`,
`NUXT_PUBLIC_OFFICE_MODE=live` (lihat `docs/deploy-railway.md`). Migrasi berjalan di `preDeployCommand`.
