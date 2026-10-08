# Hermes Virtual Office

Control plane SaaS multi-tenant untuk AI employee yang dijalankan **Hermes Agent** di runtime terisolasi per perusahaan.
Website ini mengelola organisasi, AI employee, tugas, approval, dan memvisualisasikan event nyata dari Hermes.
Bukan engine agent; tidak ada aktivitas agent palsu (mode demo = fixture berlabel DEMO tanpa aksi).

- Arsitektur & verifikasi kapabilitas Hermes: `docs/audit-phase0.md`
- Memasang runtime per tenant: `docs/runtime-tenant.md`, `deploy/docker-compose.tenant.yml`
- Aturan kerja: `CLAUDE.md`

## Menjalankan
```
npm install
cp .env.example .env   # isi DATABASE_URL, ENCRYPTION_KEY, NUXT_SESSION_PASSWORD
node scripts/migrate.mjs
npm run seed:admin -- admin@contoh.id "Admin" <password≥10>
npm run dev
```
Mode demo UI (tanpa DB/aksi): `NUXT_PUBLIC_OFFICE_MODE=demo npm run dev`.

## Test
```
DATABASE_URL_TEST=postgres://postgres@127.0.0.1:5433/hermes_office_test npm test
```
Membangun server, menjalankan Hermes tiruan (TEST DOUBLE, `test/fixtures/hermes-palsu.mjs`), lalu menguji isolasi tenant,
HMAC/replay/duplikat, alur tugas → run → subagent → selesai, cancel, approval, dan status UNKNOWN.
