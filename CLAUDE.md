# CLAUDE.md — Hermes Virtual Office

Control plane SaaS multi-tenant untuk "AI employee" yang dijalankan **Hermes Agent** (NousResearch) di runtime terisolasi per
tenant (1 container per perusahaan di VPS). Website ini = manajemen, kebijakan, approval, dan visualisasi event; **bukan**
engine agent. Sumber kebenaran arsitektur & keamanan: PRD "Hermes Virtual Office Production PRD v1.0" + laporan audit
`docs/audit-phase0.md`. Pemilik: Asyam. Nuxt 4 + Nuxt UI 4 + Drizzle/Postgres, deploy Railway (terpisah dari dashboard SSN).

## Cara kerja dengan Asyam
- Balas **Bahasa Indonesia informal**. Kerjakan sendiri; tanya hanya untuk akun/uang/keputusan bisnis.
- Kode & kontrak API dalam **bahasa Inggris** (nama tabel/kolom/event), UI & komentar **Bahasa Indonesia**.
- `npm run typecheck` dan `npm test` WAJIB lolos sebelum push. Jangan commit `.env`/rahasia.

## Invarian produk (tidak bisa ditawar)
1. **Tidak ada aktivitas agent palsu.** Setiap status/run/tool call yang tampil harus berasal dari `task_events`
   (webhook Hermes, poll `GET /v1/runs/{id}`, atau command yang dipersist). Mode `demo` memakai fixture berlabel **DEMO**
   dan **tidak merender** tombol aksi kontrol.
2. **Jangan mengarang API Hermes.** Kontrak yang dipakai hanya yang terverifikasi di `docs/audit-phase0.md`
   (Runs API, outbound webhook `X-Hermes-Signature-256`, hook `subagent_start/stop`, dll). Fitur yang tidak diiklankan
   `GET /v1/capabilities` → `TidakDidukungRuntime`, bukan mock sukses.
3. **Cancel = permintaan.** `stop` → `CANCEL_REQUESTED`; `CANCELLED` hanya setelah runtime mengirim `run.cancelled`.
   Runtime diam ≠ selesai → `UNKNOWN` lalu rekonsiliasi.
4. **Isolasi tenant.** Semua query/endpoint tenant lewat `wajibAnggota(event, orgId, peran)`; identitas runtime diambil
   dari kunci URL + HMAC per runtime, tidak pernah dari body.
5. **Rahasia** (API key runtime, secret outbound) terenkripsi AES-GCM di DB; tool input/output diredaksi sebelum tampil.

## Keputusan yang mengubah PRD
- **Kantor Virtual = 3D interaktif** (Asyam, 8 Okt 2026; PRD §02/§10 semula menunda 3D). Dibangun dengan Three.js + TresJS
  (`app/components/kantor/*`, `app/utils/kantor3d.ts`). Invarian #1 tetap: karakter bergerak/menyala hanya bila
  `runAktif > 0` dari `agent_runs`; tidak ada animasi "sibuk" acak, tidak ada gelembung pikiran palsu.

## Perintah
```
npm install && cp .env.example .env     # isi DATABASE_URL, ENCRYPTION_KEY, NUXT_SESSION_PASSWORD
npm run dev
npm run typecheck
npm test                                 # butuh DATABASE_URL_TEST (Postgres lokal)
npm run db:generate                      # migrasi dari server/database/schema.ts
```
Runtime tenant: lihat `docs/runtime-tenant.md` + `deploy/docker-compose.tenant.yml`.

## Peta kode
`server/database/schema.ts` skema · `server/utils/hermes-client.ts` adapter Runs API · `server/utils/hermes-normalisasi.ts`
webhook → `task_events` · `server/utils/perintah.ts` + `server/plugins/perintah-worker.ts` command bridge ·
`server/plugins/rekonsiliasi.ts` poll run non-terminal · `server/api/webhooks/hermes/[kunci].post.ts` inbound ·
`server/api/orgs/[orgId]/*` endpoint tenant · `app/composables/useOffice.ts` sumber data UI (demo|live) · `fixtures/demo/*`.
