# Setup Hook Hermes → Hermes Virtual Office

Panduan menyambungkan satu runtime Hermes Agent (NousResearch) ke control plane supaya kantor virtual menerima event
nyata. Semua perintah/kunci konfigurasi di sini diverifikasi dari source upstream Hermes commit `457a1e1` (8 Okt 2026);
rinciannya ada di `docs/audit-phase0.md`. **Cek ulang di versi yang lo pasang** dengan `hermes --version` dan
`GET /v1/capabilities` (langkah 6) karena Hermes berubah cepat.

Ada dua arah koneksi, dua-duanya wajib:

| Arah | Mekanisme Hermes | Dipakai untuk |
|---|---|---|
| Hermes → control plane | **Outbound webhook** (`hooks.outbound` di `config.yaml`), HMAC-SHA256 | event: sesi mulai/selesai, subagent, tool, approval → gerak karakter & timeline |
| Control plane → Hermes | **API server** (`API_SERVER_ENABLED`, Bearer `API_SERVER_KEY`) | kirim tugas (`POST /v1/runs`), poll status, stop, jawab approval |

---

## 0. Prasyarat
- Hermes terpasang di VPS (container per tenant, lihat `deploy/docker-compose.tenant.yml`) dan sudah bisa `hermes chat`.
- Control plane sudah live (contoh: `https://hermes-office-production.up.railway.app`).
- Lo punya akun **platform admin** di control plane (akun seed pertama).
- Jaringan: VPS bisa keluar ke HTTPS control plane; control plane bisa masuk ke port API server Hermes
  **lewat jaringan privat** (WireGuard/Tailscale/VPC), bukan internet publik.

Cek versi:
```bash
hermes --version
```

## 1. Daftarkan runtime di control plane (dapat kunci webhook + secret)
**Cara termudah: lewat browser.** Login sebagai platform admin → menu **Pengaturan** → pilih organisasi → kartu
**Runtime Hermes** → isi nama, base URL API server Hermes (harus terjangkau dari control plane), `API_SERVER_KEY`
(≥16 karakter), secret HMAC (kosongkan = dibuat otomatis) → **Pasang & tampilkan kunci**. URL webhook, secret, dan blok
`config.yaml` siap-salin tampil **sekali**; tombol **Probe /v1/capabilities** mengecek koneksi + membaca fitur runtime.
Tidak perlu terminal atau membagikan password admin ke siapa pun.

Alternatif via API (sesi admin → `cookie.txt`):
```bash
curl -sS -X POST https://<control-plane>/api/admin/runtimes \
  -H 'Content-Type: application/json' -b cookie.txt \
  -d '{"organizationId":"<uuid organisasi>","name":"utama","baseUrl":"http://<ip-privat-vps>:8642","apiKey":"<API_SERVER_KEY, min 16 karakter>"}'
```
Respons (hanya ditampilkan **sekali**, simpan):
```json
{
  "runtime": { "id": "…", "organizationId": "…", "baseUrl": "http://10.0.0.5:8642" },
  "webhookUrl": "https://<control-plane>/api/webhooks/hermes/<kunci-acak>",
  "outboundSecret": "<secret-acak>"
}
```
- `webhookUrl` → tujuan outbound webhook Hermes. Kuncinya hanya disimpan sebagai hash; kalau hilang, daftarkan ulang.
- `outboundSecret` → kunci HMAC. Disimpan terenkripsi (AES-GCM) di control plane.
- `apiKey` yang lo kirim harus **sama persis** dengan `API_SERVER_KEY` di langkah 2.

## 2. Env runtime Hermes (`$HERMES_HOME/.env`, di container = `/opt/data/.env`)
```bash
# API server (arah control plane → Hermes)
API_SERVER_ENABLED=true
API_SERVER_HOST=0.0.0.0          # HANYA aman di jaringan privat; default 127.0.0.1
API_SERVER_PORT=8642
API_SERVER_KEY=<sama dengan apiKey di langkah 1, min 16 karakter>

# Secret HMAC outbound (arah Hermes → control plane)
HERMES_OUTBOUND_WEBHOOK_SECRET=<outboundSecret dari langkah 1>
```
Hermes menolak start API server bila `API_SERVER_KEY` kosong, placeholder, atau < 16 karakter.

## 3. `config.yaml` runtime (`$HERMES_HOME/config.yaml`)
```yaml
hooks:
  outbound:
    - name: virtual-office
      url: https://<control-plane>/api/webhooks/hermes/<kunci-acak>   # dari webhookUrl langkah 1
      events:
        - on_session_start
        - on_session_end
        - subagent_start
        - subagent_stop
        - post_tool_call
        - pre_approval_request
        - post_approval_response
      secret_env: HERMES_OUTBOUND_WEBHOOK_SECRET   # nama env var, BUKAN nilainya
      timeout: 10                                  # detik per percobaan, 1–60

approvals:
  mode: manual            # jangan `off`; `smart` = LLM memutuskan sendiri → tidak cocok untuk tenant
  timeout: 300
  unattended_mode: deny

delegation:
  subagent_auto_approve: false
  max_concurrent_children: 5

platforms:
  api_server:
    enabled: true
```
Catatan:
- `events` harus nama yang ada di `VALID_HOOKS` Hermes; nama salah → entri dilewati dengan warning (tidak crash).
- `matcher` (regex nama tool) hanya berlaku untuk `pre_tool_call`/`post_tool_call`, mis. `matcher: "terminal|delegate_task"` bila mau menyaring.
- Tanpa `secret_env`/`secret`, pengiriman **UNSIGNED** dan control plane menolaknya (401). Pakai `secret_env`.
- `HERMES_SAFE_MODE=1` mematikan semua hook termasuk outbound.
- Perubahan berlaku setelah restart: `hermes gateway restart`.

Opsional, kalau mau kanban Hermes ikut tampil: tambahkan `kanban_task_claimed`, `kanban_task_completed`, `kanban_task_blocked`.

## 4. Jalankan & verifikasi di sisi Hermes
```bash
hermes gateway restart
hermes hooks list          # harus ada "virtual-office" dengan status "signed" (bukan UNSIGNED)
hermes hooks test on_session_start
hermes hooks doctor
hermes logs --follow --level INFO | grep -i "outbound webhook"
```
Log yang diharapkan saat start: `outbound webhook registered: on_session_start -> virtual-office (...)`.

## 5. Verifikasi di sisi control plane
```bash
# 1) kapabilitas runtime terbaca (admin)
curl -sS -X POST https://<control-plane>/api/admin/runtimes/<runtime id>/probe -b cookie.txt
# → {"ok":true,"capabilities":{"features":{"run_submission":true,"run_status":true,"run_stop":true,"run_approval_response":true,...}}}

# 2) event webhook masuk: Pusat Komando → "Kesehatan runtime" → "Event terakhir" berubah,
#    atau cek tabel webhook_inbox (signature_ok = true, processed_at terisi, error kosong).
```
Lalu uji alur penuh dari UI: kirim satu tugas ke AI employee → command `ACCEPTED` → status tugas `RUNNING` → karakter
mengetik di kantor → event `tool.completed` muncul sebagai chip → selesai `COMPLETED`.

## 6. Yang terjadi di kantor 3D untuk tiap event
| Event Hermes | Dipetakan ke | Efek di kantor |
|---|---|---|
| `POST /v1/runs` diterima (202) | `run.submitted` | karakter jalan dari HQ ke mejanya |
| `on_session_start` | `session.started` | — (dicatat di timeline) |
| `post_tool_call` | `tool.completed` | gerakan kecil + chip `tool: <nama>` (argumen tool diredaksi) |
| `subagent_start` / `subagent_stop` | `subagent.started/finished` | asisten kecil keluar ke Lab, kembali saat selesai |
| `pre_approval_request` / status `waiting_for_approval` | `approval.requested` | karakter jalan ke Ruang Meeting dan duduk menunggu |
| `post_approval_response` | `approval.resolved` | kembali bekerja |
| poll `GET /v1/runs/{id}` → `completed` | `run.completed` | lompat kecil "selesai", lalu idle |
| poll → `stopping` / `cancelled` | `run.stop_requested` / `run.cancelled` | layar meja amber berkedip, lalu idle |
| run tidak ditemukan / runtime diam | `UNKNOWN` | layar amber, karakter "bingung"; tidak pernah dianggap selesai |

## 7. Troubleshooting
| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `hermes hooks list` → `UNSIGNED` | `secret_env` tidak diset di `.env` atau nama var salah | isi `HERMES_OUTBOUND_WEBHOOK_SECRET`, restart |
| Control plane 401 "Tanda tangan tidak sah" | secret di Hermes ≠ `outboundSecret` yang didaftarkan | daftarkan ulang runtime (langkah 1) dan samakan |
| 401 "Timestamp basi" | jam VPS meleset > 5 menit | sinkronkan NTP di VPS |
| 404 di URL webhook | kunci URL salah/terpotong | pakai `webhookUrl` persis dari langkah 1 |
| 503 "Secret outbound runtime belum dipasang" | runtime terdaftar tanpa secret | daftarkan ulang |
| 200 `{"status":"duplicate"}` | `delivery_id` sudah pernah diterima | normal (Hermes retry 1×) |
| Probe gagal / runtime `offline` | control plane tidak bisa mencapai `baseUrl` | cek jaringan privat & `API_SERVER_HOST=0.0.0.0`, port 8642 |
| Tugas `REJECTED` "tidak mengiklankan fitur" | `/v1/capabilities` tidak memuat `run_submission` dll | versi Hermes lama → update; jangan diakali |
| Event hilang saat gateway restart | outbound = antrean in-memory, best-effort | normal; control plane merekonsiliasi lewat poll tiap menit |

## 8. Yang JANGAN dilakukan
- Jangan pakai `hermes -z/--oneshot` untuk tenant: mode itu memaksa YOLO (semua approval dilewati).
- Jangan berbagi `HERMES_HOME`, token provider, atau secret antar tenant.
- Jangan ekspos port 8642 ke internet; cukup jaringan privat ke control plane.
- Jangan set `approvals.mode: off`.
