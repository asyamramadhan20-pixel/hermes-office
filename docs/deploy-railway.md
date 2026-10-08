# Deploy ke Railway (service terpisah dari dashboard SSN)

Repo: https://github.com/asyamramadhan20-pixel/hermes-office (branch `main`). Build & start sudah diatur di `railway.json`
(Nixpacks, `npm ci && npm run build`, preDeploy `node scripts/migrate.mjs`, healthcheck `/api/health`, 1 replika).

## Cara tercepat: workflow "Railway setup" (sekali jalan)
1. Di Railway: buat **project kosong**, lalu Project → Settings → Tokens → buat **Project Token** (environment `production`).
2. Di GitHub repo: Settings → Secrets and variables → Actions → **New repository secret** `RAILWAY_TOKEN` = token tadi.
3. Tab **Actions → "Railway setup (sekali jalan)" → Run workflow**: isi email admin, biarkan `buat_database` = true.
   Workflow membuat Postgres, service `hermes-office`, variabel (kunci acak), domain publik, lalu deploy pertama.
4. Cek `https://<domain>/api/health`. Login dengan email admin; password ada di Railway → Variables → `SEED_ADMIN_PASSWORD`.
   **Hapus** `SEED_ADMIN_EMAIL/NAME/PASSWORD` setelah login pertama.
5. Selanjutnya setiap push ke `main` yang lolos test di-deploy otomatis oleh job `deploy` di `ci-cd.yml` (secret yang sama).

## Alternatif manual lewat dashboard Railway
1. **New Project → Deploy from GitHub repo** → pilih `hermes-office`, branch `main`.
2. Di project yang sama: **+ New → Database → PostgreSQL**. Railway membuat variabel `DATABASE_URL` di service Postgres.
3. Buka service `hermes-office` → **Variables**, isi:
   | Variabel | Nilai |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referensi ke service Postgres) |
   | `ENCRYPTION_KEY` | hasil `openssl rand -base64 32` |
   | `NUXT_SESSION_PASSWORD` | hasil `openssl rand -base64 32` (beda dari di atas) |
   | `NUXT_PUBLIC_APP_URL` | `https://<domain-railway-atau-custom>` (tanpa garis miring di akhir; dipakai untuk membentuk URL webhook) |
   | `NUXT_PUBLIC_OFFICE_MODE` | `live` |
   | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_NAME` / `SEED_ADMIN_PASSWORD` | akun platform admin pertama (≥10 karakter). **Hapus ketiganya setelah deploy pertama sukses.** |
4. **Settings → Networking → Generate Domain** (atau pasang domain sendiri), lalu samakan `NUXT_PUBLIC_APP_URL`.
5. Deploy. Cek `https://<domain>/api/health` → `{"status":"ok","database":"terhubung"}`.
6. Login dengan akun seed → buat organisasi & anggota lewat `POST /api/admin/orgs` dan `/api/admin/orgs/:id/members`
   (UI admin menyusul), lalu pasang runtime Hermes sesuai `docs/runtime-tenant.md`.

## Catatan
- Push ke GitHub **tidak** otomatis deploy kecuali lo aktifkan di Railway (Settings → Source → auto deploy). Pola di dashboard SSN
  memakai `railway up --service <nama> --detach` manual; bisa dipakai di sini juga.
- Migrasi jalan otomatis saat preDeploy; tidak perlu `drizzle-kit` di produksi.
- Jangan sambungkan service ini ke database dashboard SSN. Data tenant terpisah total.
