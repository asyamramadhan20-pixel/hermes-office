# Runtime Hermes per tenant (VPS)

Satu perusahaan = satu container Hermes Agent dengan `HERMES_HOME` sendiri (volume terpisah), `API_SERVER_KEY` sendiri,
dan secret outbound sendiri. Tidak ada volume/token/profil browser yang dibagi antar tenant (PRD §05).
Semua kontrak di bawah terverifikasi di `docs/audit-phase0.md` (upstream `457a1e1`); **cek ulang pada versi yang terpasang**
dengan `GET /v1/capabilities` (control plane menyimpannya apa adanya dan menyembunyikan aksi yang tidak diiklankan).

## 1. Pasang runtime di control plane (platform admin)
```
POST /api/admin/runtimes
{ "organizationId": "<uuid org>", "baseUrl": "http://10.0.0.5:8642", "apiKey": "<API_SERVER_KEY ≥16 char>" }
```
Respons memuat **sekali saja**: `webhookUrl` (kunci di path, hanya hash-nya disimpan) dan `outboundSecret`
(disimpan terenkripsi AES-GCM). Simpan keduanya ke env container tenant.

## 2. Env container tenant (`.env` di HERMES_HOME)
```
API_SERVER_ENABLED=true
API_SERVER_HOST=0.0.0.0          # HANYA di jaringan privat (WireGuard/Tailscale/Railway private); jangan ekspos publik
API_SERVER_PORT=8642
API_SERVER_KEY=<sama dengan apiKey di langkah 1>
HERMES_OUTBOUND_WEBHOOK_SECRET=<outboundSecret dari langkah 1>
```

## 3. `config.yaml` tenant (potongan yang relevan)
```yaml
hooks:
  outbound:
    - name: virtual-office
      url: https://<control-plane>/api/webhooks/hermes/<kunci dari webhookUrl>
      events: [on_session_start, on_session_end, subagent_start, subagent_stop, post_tool_call,
               pre_approval_request, post_approval_response]
      secret_env: HERMES_OUTBOUND_WEBHOOK_SECRET
      timeout: 10

approvals:
  mode: manual            # jangan `smart`/`off`: approval harus lewat manusia (PRD §07)
  timeout: 300
  unattended_mode: deny

delegation:
  subagent_auto_approve: false
  max_concurrent_children: 5

platforms:
  api_server:
    enabled: true
```
Catatan terverifikasi: outbound webhook itu **fire-and-forget** (antrean in-memory 256, retry 1×) — control plane
merekonsiliasi lewat `GET /v1/runs/{id}` tiap menit, jadi event yang hilang tidak membuat status macet.
Jangan pernah menjalankan `hermes -z/--oneshot` untuk tenant: mode itu memaksa YOLO (bypass approval).

## 4. Container
Lihat `deploy/docker-compose.tenant.yml`. Prinsip: non-root (`hermes`, uid 10000), tanpa `privileged`, tanpa mount
`docker.sock`, batas CPU/memori/pids, egress dibatasi firewall host ke provider LLM + control plane saja.

## 5. Verifikasi setelah naik
1. `curl -H "Authorization: Bearer $API_SERVER_KEY" http://<ip-privat>:8642/v1/capabilities` → `features.run_submission: true` dst.
2. Di control plane: `POST /api/admin/runtimes/<id>/probe` → status `online`, fitur tersimpan.
3. Kirim 1 tugas dari UI → `commands.state = ACCEPTED` → `agent_runs.status` berubah dari poll → event webhook masuk ke `webhook_inbox` (`signature_ok = true`).
4. Batalkan → `CANCEL_REQUESTED` → `CANCELLED` hanya setelah runtime mengembalikan `cancelled`.
