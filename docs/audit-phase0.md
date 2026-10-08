# Hermes Virtual Office — Audit Phase 0 & Rencana Phase 1

> Versi 2 — 2026-10-08. Status: **AUDIT SELESAI, IMPLEMENTASI MENUNGGU APPROVAL** (lihat §9).
> Sumber: PRD "Hermes Virtual Office Production PRD v1.0" + Fable Design Brief (diterima 8 Okt), repo `ceo-dashboard`,
> dan source upstream **Hermes Agent (NousResearch)** commit `457a1e1cdb7f` (8 Okt 2026, rilis `2026.9.24`).
> Tidak ada kode aplikasi yang diubah. Semua referensi `file:baris` di §3–§5 merujuk ke repo upstream Hermes.

---

## 1. Current State

### 1a. Repo `ceo-dashboard` (SSN dashboard, produksi)
| Area | Fakta | File |
|---|---|---|
| Stack | Nuxt 4.5.2, Nuxt UI 4.11.2, Drizzle 0.45 + Postgres, ECharts 6, nitro `node-server`, 1 replika Railway | `package.json`, `nuxt.config.ts`, `railway.json` |
| Auth | nuxt-auth-utils; `wajibLogin` / `wajibAdmin` (role `superadmin`/`ceo`); role = kolom `text`, tanpa tabel permission | `server/utils/auth.ts`, `server/database/schema.ts` |
| Kredensial terenkripsi | AES-256-GCM, tabel `integration_credentials` unik `(provider, fieldKey)` (global, tanpa tenant) | `server/utils/crypto.ts`, `server/utils/kredensial.ts` |
| Webhook inbound | HMAC-SHA256 `${timestamp}.${rawBody}` + toleransi 5 mnt; pola kunci-di-URL + tabel `webhook_inbox` | `server/api/webhooks/*`, `server/utils/webhook-signature.ts` |
| Audit log | `settings_audit_log` via `catatAudit()` | `server/utils/auth.ts` |
| Scheduler | `defineNitroPlugin` + `setInterval` in-process, tanpa lock/queue | `server/plugins/*.ts` |
| Realtime | **tidak ada** SSE/WS; polling 60 dtk | `app/components/TerakhirDiperbarui.vue` |
| Tenant/org | **tidak ada** | — |
| Kode agent/LLM | **tidak ada** | — |

### 1b. Instalasi Hermes milik Asyam
**Tidak dapat diakses dari sesi ini** (tidak ada VPS/container/kredensial). Semua verifikasi di bawah memakai source upstream
HEAD. Status tiap kapabilitas = **Conditional** sampai versi/commit yang terpasang di VPS dikonfirmasi
(`hermes --version` / `git rev-parse HEAD` di VPS). PRD §04 memang mengizinkan ini: "Never assume a documented event exists
in the deployed version."

---

## 2. Ringkasan temuan utama
1. **Hermes sudah punya outbound webhook bertanda tangan HMAC** (`hooks.outbound` di config). Tidak perlu plugin kustom untuk
   Phase 2. Payload sudah memuat `delivery_id` + `timestamp` di dalam body yang ditandatangani → dedupe + anti-replay.
2. **Ada inbound control API resmi**: `POST /v1/runs` (202 + `run_id`, header `Idempotency-Key`), `GET /v1/runs/{id}` (poll),
   `GET /v1/runs/{id}/events` (SSE), `POST /v1/runs/{id}/stop`, `POST /v1/runs/{id}/approval`, `POST /v1/runs/{id}/steer`.
   Fitur diiklankan lewat `GET /v1/capabilities` → control plane bisa **mendeteksi dukungan per versi**, bukan mengasumsikan.
3. **Korelasi subagent tersedia**: hook `subagent_start` membawa `parent_session_id`, `child_session_id`, `child_subagent_id`;
   `subagent_stop` membawa `child_status`, `duration_ms`, `tool_call_history`. DB `sessions.parent_session_id` menyimpan silsilah.
4. **Kanban bawaan Hermes** (SQLite `kanban.db`, status `triage|todo|scheduled|ready|running|blocked|review|done|archived`,
   kolom `tenant`, `idempotency_key`) + hook `kanban_task_claimed/completed/blocked`. Ini kandidat kuat untuk "task lifecycle"
   di sisi runtime, tapi **1 board per HERMES_HOME** → cocok dengan 1 container per tenant.
5. **Batasan penting**: outbound webhook = fire-and-forget (queue 256 in-memory, retry 1×, hilang saat crash) → control plane
   **wajib rekonsiliasi** lewat `GET /v1/runs/{id}` dan `GET /api/sessions/*`. Cancel = `stopping` sampai runtime konfirmasi
   `run.cancelled` (persis semantik `REQUEST_CANCEL` di PRD §07).
6. **Approval**: `pre_approval_request`/`post_approval_response` hanya observer (tidak bisa menjawab). Jawaban resmi hanya via
   `POST /v1/runs/{id}/approval` (choice `once|session|always|deny`) untuk run yang dibuat lewat API server.
   Mode oneshot (`hermes -z`) **memaksa YOLO** (bypass approval) → **jangan dipakai** untuk runtime tenant.

---

## 3. Verified Capability Matrix (upstream HEAD `457a1e1`)
Status: **V** = ada di source & docs; **C** = ada tapi tergantung konfigurasi/versi terpasang; **U** = tidak ada.

### 3a. Outbound (Hermes → control plane)
| Kapabilitas | Status | Bukti |
|---|---|---|
| Outbound webhook HTTP, signed HMAC-SHA256 raw body, header `X-Hermes-Signature-256: sha256=<hex>` | V/C | `agent/outbound_webhooks.py:241-262`; config parse `:106-219`; registrasi `gateway/run_startup.py:1113-1116`, `cli.py:463-468` |
| `delivery_id` + `timestamp` di dalam body signed; header `X-Hermes-Event`, `X-Hermes-Delivery` | V | `agent/outbound_webhooks.py:241-258` |
| Body: `hook_event_name, profile, tool_name, tool_input, session_id, cwd, extra{…}` | V | `agent/outbound_webhooks.py:248-251`, `agent/shell_hooks.py:79-94` |
| Event apa pun di `VALID_HOOKS` bisa dikirim; `matcher` regex hanya untuk `pre/post_tool_call` | V | `agent/outbound_webhooks.py:182`; `hermes_cli/plugins.py:109-204` |
| Delivery: queue in-memory 256, 1 thread, retry 1× (5xx/koneksi), 4xx/3xx final, drop saat penuh | V (batasan) | `agent/outbound_webhooks.py:42, 266-340` |
| Durable outbox / ledger retry outbound | **U** | NOT FOUND |
| Tanpa secret → dikirim UNSIGNED (warning) | V (risiko) | `agent/outbound_webhooks.py:212` |
| `HERMES_SAFE_MODE=1` mematikan outbound | V | `agent/outbound_webhooks.py:77` |
| Plugin hook (`ctx.register_hook`) CLI+gateway, dispatch sinkron di thread pemanggil; hot-path dibatasi `plugins.hook_callback_timeout` 30 dtk | V | `hermes_cli/plugins.py:933`, `hermes_cli/plugins_dispatch.py:42-48, 211` |
| Gateway hooks `~/.hermes/hooks/<name>/HOOK.yaml+handler.py` (event `agent:start/step/end`, `session:*`) — trusted-by-placement, gateway only | V | docs `hooks.md:20-110`; loader `gateway/run_startup.py` |
| OTLP export: hanya health/diagnostic gateway, tanpa konten sesi | V (tidak cukup) | `agent/monitoring/otlp_exporter.py`; `hermes_cli/config_defaults.py:2081-2098` |

### 3b. Hook per nama (kandidat PRD §06)
| Hook | Status | Definisi | Fire site | Payload (kwargs) |
|---|---|---|---|---|
| `on_session_start` | V | `hermes_cli/plugins.py:132` | `agent/conversation_loop.py:861` | `session_id, model, platform` |
| `on_session_end` | V | `plugins.py:132` | `agent/turn_finalizer.py:794-804` (per turn) | `session_id, task_id, turn_id, completed, failed, interrupted, turn_exit_reason, model, platform` |
| `subagent_start` | V | `plugins.py:135` | `tools/delegate_tool.py:327-334` | `parent_session_id, parent_turn_id, parent_subagent_id, child_session_id, child_subagent_id, child_role, child_goal` |
| `subagent_stop` | V | `plugins.py:135` | `tools/delegate_tool_results.py:364-371` | `parent_session_id, parent_turn_id, child_session_id, child_role, child_summary, child_status(completed/failed/interrupted/error), tool_call_history, duration_ms` |
| `pre_tool_call` | V (bisa veto) | `plugins.py:110` | `hermes_cli/plugins.py:1987-1991` | `tool_name, args, task_id, session_id, tool_call_id, turn_id, api_request_id`; return `{action: block|approve|modify}`; **fail-closed** |
| `post_tool_call` | V | `plugins.py:110` | `model_tools.py:694-698` | `tool_name, args, result, task_id, session_id, tool_call_id, turn_id, duration_ms, status, error_type, error_message` |
| `pre_approval_request` | V (observer) | `plugins.py:147` | `tools/approval_context.py:54`; `tools/approval.py:890`, `approval_gateway_wait.py:203` | `command, description, pattern_key, pattern_keys, session_key, surface, turn_id, tool_call_id, session_id` |
| `post_approval_response` | V (observer) | `plugins.py:147` | sama + `choice` (`once/session/always/deny/timeout/cancelled/notify_failed/smart_approve/smart_deny`) | |
| `kanban_task_claimed` | V | `plugins.py:162` | `hermes_cli/kanban_db.py:2227` | `task_id, profile_name, board, assignee, run_id` |
| `kanban_task_completed` | V | `plugins.py:162` | `kanban_db.py:2761` | + `summary` |
| `kanban_task_blocked` | V | `plugins.py:162` | `kanban_db.py:3231-3233` | + `reason` |
| Catatan | | | | Payload kanban **tidak memuat session_id**; `worker_session_id` ada di metadata `task_runs` (`tools/kanban_tools.py:244-247`). Semua hook punya `telemetry_schema_version="hermes.observer.v1"` (`plugins_dispatch.py:223`). |

### 3c. Inbound (control plane → Hermes)
| Kapabilitas | Status | Bukti |
|---|---|---|
| API server aiohttp, default `127.0.0.1:8642`, Bearer `API_SERVER_KEY` (≥16 char, `hmac.compare_digest`) | V/C (harus diaktifkan: `API_SERVER_ENABLED=true`) | `gateway/platforms/api_server.py:216-231, 1559-1581, 4421-4478` |
| `POST /v1/runs` → 202 `{run_id, status:"started"}`; body `input, instructions, session_id, conversation_history, previous_response_id, model, provider` | V | `gateway/platforms/api_server_runs.py:620-756` |
| `Idempotency-Key` header (replay → 202 + `Idempotency-Replayed: true`; payload beda → 409) | V | `api_server_run_idempotency.py`; docs `api-server.md:448-466` |
| `GET /v1/runs/{id}` status: `queued, running, waiting_for_approval, stopping` + terminal `completed, failed, cancelled, interrupted` | V | `api_server_run_idempotency.py:19`; `api_server_runs.py:258-272, 986` |
| `GET /v1/runs/{id}/events` SSE: `message.delta`, `tool.started/completed`, `subagent.start/complete` (bawa `child_session_id`, `delegation_id`), `approval.request/responded`, `run.<terminal>`; `Last-Event-ID` replay; keepalive 10 dtk | V | `api_server_runs.py:921-948, 1064-1153`; docs `api-server.md:491-552` |
| `POST /v1/runs/{id}/stop` → `{status:"stopping"}`; terminal → `run.cancelled`; 409 `run_not_active` | V | `api_server_runs.py:1253-1274`; interrupt core `agent/interrupt_control.py:128-236` |
| `POST /v1/runs/{id}/approval` body `choice: once|session|always|deny`, `request_id`, `all` | V | `api_server_runs.py:1165-1216` |
| `POST /v1/runs/{id}/steer` | V | `api_server_runs.py:1219-1250` |
| `GET /v1/capabilities` (deteksi fitur: `run_submission, run_status, run_events_sse, run_stop, run_approval, session_*`) | V | `api_server.py:68-102` |
| Sessions REST `/api/sessions` (list/create/get/messages/fork/chat/chat/stream) | V | `api_server.py:1736-1745, 3570-3615` |
| Jobs REST `/api/jobs` (cron) | V | `api_server.py:1753-1760` |
| Multi-profile `/p/<profile>/…` dengan key per profil | V (tidak dipakai; 1 container/tenant) | `gateway/config.py:46-60`; `api_server.py:36-43` |
| Webhook inbound Hermes (port 8644, HMAC per route, 202 `{delivery_id}`; **tidak** mengembalikan run/session id) | V (tidak dipakai untuk command) | `gateway/platforms/webhook.py:61, 240-245, 708, 769-802` |
| Cap konkurensi → 429 `Retry-After: 1` | V | `api_server.py:4081-4094` |
| Headless `hermes -z` = **YOLO paksa** (bypass approval) | V (dilarang untuk tenant) | `hermes_cli/oneshot.py:275-280` |
| `hermes chat -q --format stream-json` (JSONL + `session_id`) | V (alternatif, bukan utama) | `hermes_cli/stream_json.py`, `cli_single_query.py` |
| MCP `permissions_respond` benar-benar menyelesaikan approval | **U** | hanya hapus dari queue lokal, `mcp_serve.py:333-341` |

### 3d. Identitas & korelasi
| Item | Status | Bukti |
|---|---|---|
| Session id `YYYYMMDD_HHMMSS_<hex6>`; `run_<hex32>`, `api_<epoch>_<hex8>`, `cron_<job>_<ts>` | V | `hermes_state_ids.py:21-60` |
| `sessions.parent_session_id` (+ `model_config._delegate_from`) | V | `hermes_state_common.py:398, 445`; `tools/delegate_tool.py:314-315` |
| `root_session_id` | **U** | jalan ke akar via loop ≤100 hop `hermes_state_sessions.py:1533-1547` |
| Subagent id `sa-<idx>-<hex8>`, `delegation_id = deleg_<hex8>` | V | `tools/delegate_tool.py:233`; `tools/async_delegation.py:672-673` |
| Child session id **tidak ada** di hasil tool yang dilihat model; hanya di hook/SSE | V | `tools/delegate_tool_child_run.py:552-620` |
| `HERMES_SESSION_ID` di env/ContextVar | V | `gateway/session_context.py:83-92` |
| Usage per sesi (`sessions.*_tokens`, `estimated_cost_usd`, `actual_cost_usd`; `session_model_usage`) | V | `hermes_state_common.py:404-426, 482-502`; `hermes_state_usage.py:273-337` |
| Usage per `delegation_id`/kanban `task_id` | **U** | hanya per `session_id` |
| Delegasi: max 10 anak konkuren, depth default 1, `child_timeout_seconds` opsional | V | `tools/delegate_tool_config.py:17-21, 93-99, 139-145` |
| Kanban: `tasks` (`tenant`, `idempotency_key`, `session_id`, `current_run_id`), `task_runs`, `task_events` append-only; worker = subprocess `hermes chat -q` dgn `HERMES_KANBAN_TASK`, `HERMES_KANBAN_RUN_ID` | V | `hermes_cli/kanban_db.py:801-1008`; `kanban_db_dispatch.py:2745-2909` |

### 3e. Runtime & isolasi
| Item | Status | Bukti |
|---|---|---|
| `HERMES_HOME` env → root data; Docker `HERMES_HOME=/opt/data`, `VOLUME /opt/data` | V | `hermes_constants.py:51-58, 111-117`; `Dockerfile:448-449, 495` |
| Proses utama drop ke user `hermes` uid 10000 via s6 (image berakhir `USER root`, PID1 = `/init`) | V (perlu verifikasi di VPS) | `Dockerfile:175, 361, 529-530`; `docker/main-wrapper.sh:31` |
| docker-compose pakai `network_mode: host`, API server **dikomentari** | V (harus diubah) | `docker-compose.yml:25-44` |
| Approval default: `approvals.mode: smart`, timeout 300 dtk, `unattended_mode: deny`; api_server = platform unattended tapi tetap lewat bridge ask/notify | V | `hermes_cli/config_defaults.py:1665-1693`; `tools/approval_context.py:135-182`; `tools/approval.py:910-924` |
| `delegation.subagent_auto_approve` | C (harus diputuskan) | `cli-config.yaml.example:1810` |

---

## 4. Hook Mapping (Hermes → event ternormalisasi PRD §06)
Semua masuk via `POST /api/webhooks/hermes/:runtimeKey` → `webhook_inbox` (raw) → normalizer.

| Hermes `hook_event_name` | `source_event_type` | `session_id` | `agent_run_id` | Catatan |
|---|---|---|---|---|
| `on_session_start` | `session.started` | `session_id` | lookup `runs.hermes_session_id` | |
| `on_session_end` | `session.turn_ended` | `session_id` | lookup | `extra.completed/failed/interrupted` → bukan terminal task; terminal = `run.completed` dari SSE/poll |
| `subagent_start` | `subagent.started` | `extra.child_session_id` | parent via `extra.parent_session_id` | buat `agent_runs` anak, **jangan** buat `ai_employees` |
| `subagent_stop` | `subagent.finished` | `extra.child_session_id` | | `child_status`, `duration_ms`, `tool_call_history` (metadata-only) |
| `post_tool_call` | `tool.completed` | `session_id` | | `tool_name`, `extra.status/duration_ms`; **redaksi `tool_input`** sebelum disimpan ke panel klien |
| `pre_approval_request` | `approval.requested` | `extra.session_id` | | observasi; aksi jawab via `/v1/runs/{id}/approval` |
| `post_approval_response` | `approval.resolved` | | | `extra.choice` |
| `kanban_task_*` | `kanban.task.*` | — | `extra.run_id` | opsional, hanya bila kanban dipakai |

Identitas runtime: ditetapkan dari **kunci URL + HMAC secret per runtime** (server-side mapping `runtime_instances.organization_id`),
tidak pernah dari body (`profile` hanya informatif).

## 5. Command Contracts (control plane → Hermes), adapter `hermes-client`
| Command PRD | Panggilan Hermes | Hasil yang boleh diklaim |
|---|---|---|
| `ASSIGN_TASK` | `POST /v1/runs` + `Idempotency-Key = command.idempotency_key`, body `{input, instructions, session_id}` | 202 → `ACCEPTED` (bukan selesai). `run_id` disimpan. Konfirmasi eksekusi = event `run.*` / poll |
| `REQUEST_STATUS` | `GET /v1/runs/{run_id}` | status apa adanya; `interrupted` = gateway restart |
| `REQUEST_CANCEL` | `POST /v1/runs/{run_id}/stop` | `CANCEL_REQUESTED`; `CANCELLED` hanya setelah `run.cancelled` |
| `SUBMIT_APPROVAL` | `POST /v1/runs/{run_id}/approval {choice, request_id}` | `resolved:true` → `approval.resolved`; 409 → tetap `WAITING_APPROVAL` + tandai UNKNOWN |
| `PROPOSE_AGENT` / `REGISTER_AGENT` | **tidak ada API Hermes**; murni state control plane (ai_employees) + `instructions` saat `ASSIGN_TASK` | — |
| Deteksi dukungan | `GET /v1/capabilities` saat registrasi runtime; simpan ke `runtime_instances.capabilities` | fitur yang `false` → tombol UI disembunyikan / state "unsupported" |

Pemetaan status run → task: `queued→QUEUED`, `running→RUNNING`, `waiting_for_approval→WAITING_APPROVAL`, `stopping→CANCEL_REQUESTED`,
`completed→COMPLETED`, `failed→FAILED`, `cancelled→CANCELLED`, `interrupted→UNKNOWN` (rekonsiliasi), SSE putus >N menit tanpa poll → `UNKNOWN`.

## 6. Target Architecture & Trust Boundaries (ringkas)
```
[Browser] --session cookie--> [Control plane: Nuxt 4 + Nitro + Postgres (Railway)]
   SSE /api/tenants/:id/events  <---  task_events
                                       |  commands (persist dulu) -> queue (pg SKIP LOCKED) -> hermes-client
                                       v
                 HTTPS + Bearer API_SERVER_KEY per runtime (secret per tenant, terenkripsi AES-GCM)
                                       v
[VPS] docker: 1 container/tenant, HERMES_HOME volume sendiri, API_SERVER_HOST=0.0.0.0 di jaringan privat
      hooks.outbound -> HTTPS POST + HMAC -> /api/webhooks/hermes/:runtimeKey (control plane)
```
Trust boundary: (1) browser ↔ control plane: tenant/role dicek server-side setiap request; (2) control plane ↔ runtime: Bearer per
runtime, hanya reverse-proxy privat (Tailscale/WireGuard atau Railway private networking), bukan internet publik;
(3) runtime → control plane: HMAC per runtime + dedupe `delivery_id` + jendela `timestamp` 5 mnt; (4) konten tool/LLM = **untrusted**
(prompt injection), diredaksi & tidak pernah dieksekusi oleh control plane.

Keputusan desain: **repo & DB baru** (`hermes-office`), bukan di `ceo-dashboard`. Stack sama (Nuxt 4 + Drizzle) supaya pola
`crypto.ts`, `webhook-signature.ts`, `catatAudit` bisa disalin. Queue: tabel Postgres `commands` + `FOR UPDATE SKIP LOCKED`
(cukup untuk pilot; Redis ditunda). PRD menyebut Next.js; gue rekomendasikan Nuxt karena tim sudah punya pola & komponen. **Butuh keputusan Asyam.**

## 7. Security Threat Model (ringkas, dipetakan ke PRD §12)
| Ancaman | Mitigasi Phase 1–2 |
|---|---|
| Cross-tenant read via API | setiap query difilter `organization_id` dari membership sesi; test otomatis "tenant B 403/404 ke data A" |
| Event palsu / replay ke webhook | HMAC per runtime, `delivery_id` unik (unique index), `timestamp` ±5 mnt, simpan raw sebelum ACK |
| Runtime secret bocor antar tenant | 1 `API_SERVER_KEY` + 1 outbound secret per runtime, disimpan terenkripsi, dirotasi per runtime |
| Prompt injection di output tool | output hanya ditampilkan (escaped), tidak pernah memicu command; `tool_input` diredaksi |
| Eskalasi role | role enum di DB + cek server-side; tidak ada aksi kontrol untuk `viewer/auditor` |
| Cancel race / status salah | status terminal hanya dari runtime; `stopping` ≠ `cancelled` |
| Outbound hilang saat crash | rekonsiliasi berkala `GET /v1/runs/{id}` untuk run non-terminal; `interrupted` → UNKNOWN |
| Approval ditebak/dibypass | hanya `POST /v1/runs/{id}/approval` dengan `request_id` eksak; `delegation.subagent_auto_approve` **off**; oneshot YOLO dilarang |
| Container escape | non-root (`hermes` uid 10000), no privileged, no docker.sock, egress allowlist (di luar scope repo; checklist runbook) |

## 8. Gap Analysis & Risiko
- **G1 (blocker)**: versi Hermes terpasang di VPS belum diketahui → semua "V" di atas berstatus Conditional. Perlu `hermes --version` + commit.
- **G2**: `hooks.outbound` tidak ada di `cli-config.yaml.example` → harus ditulis manual di `config.yaml` tenant; contoh konfigurasi disediakan di repo baru.
- **G3**: outbound tanpa outbox durable → rekonsiliasi wajib (§5).
- **G4**: usage/biaya hanya per `session_id` → atribusi biaya per task = Σ sesi (parent + child via `parent_session_id`).
- **G5**: PRD minta Next.js + Redis; rekomendasi Nuxt + Postgres queue untuk pilot (keputusan).
- **G6**: Docker compose default `network_mode: host` + API server mati → butuh compose khusus tenant (port privat, key).
- **R-UI**: Design brief melarang ilustrasi kantor kartun sebagai dashboard default → gambar isometrik yang dikirim **tidak** dipakai sebagai layar utama; cukup roster/department cards (PRD §10).

---

## 9. Phase 1 — Vertical Slice (butuh approval)
Prinsip: backend (integrasi Hermes) dan UI (Fable brief) **dipisah**; UI memakai fixture berlabel **DEMO**, tidak ada tombol
yang memanggil API kontrol di mode demo.

### Track A — Backend (repo baru `hermes-office`, Nuxt 4 + Drizzle + Postgres, Railway service baru)
Alur tunggal: *CEO tenant A kirim 1 tugas → `POST /v1/runs` ke runtime A → event masuk via outbound webhook + SSE → timeline → cancel → `run.cancelled` tercatat; tenant B tidak melihat apa pun.*
1. Skema: `organizations, organization_memberships, users, ai_employees, agent_runs, tasks, task_events, commands, approvals,
   runtime_instances, runtime_credentials, webhook_inbox, audit_logs` (subset PRD §09; composite FK `organization_id`).
2. Auth: salin pola `server/utils/auth.ts` (argon2id, lockout) + role enum `owner|manager|member|approver|auditor|platform_admin`;
   middleware tenant: semua `/api/orgs/:orgId/*` cek membership.
3. `server/utils/hermes-client.ts`: `buatRun`, `statusRun`, `hentikanRun`, `jawabApproval`, `kapabilitas` — mapping §5. Fitur di luar
   `capabilities` → lempar `UnsupportedByRuntime` (bukan mock sukses).
4. Webhook inbound `POST /api/webhooks/hermes/:runtimeKey`: HMAC `X-Hermes-Signature-256` (GitHub-style, raw body), unique `delivery_id`,
   jendela 5 mnt, simpan raw → ACK 202 → normalizer async (§4).
5. Queue command: tabel `commands` + worker Nitro plugin (`SKIP LOCKED`), state mesin PRD §07.
6. Rekonsiliasi: plugin tiap 60 dtk poll `GET /v1/runs/{id}` untuk run non-terminal.
7. SSE `GET /api/orgs/:orgId/events` (Nitro `createEventStream`).
8. Audit: `audit_logs` per aksi kontrol (pola `catatAudit` + `organization_id`).
9. Test: HMAC/replay (adaptasi `test/webhook-signature.mjs`), isolasi tenant (2 org seed), transisi status.
10. Runtime tenant (docs + compose contoh, di luar kode app): `docker-compose.tenant.yml` dengan `API_SERVER_ENABLED`, `API_SERVER_KEY`,
    `hooks.outbound` ke URL webhook + `secret_env`, `approvals.mode: manual`, `delegation.subagent_auto_approve: false`.

### Track B — Frontend (Fable brief; **FIRST ACTION**: design tokens + CEO Command Center saja)
- Token: graphite `#101319`, pale gray `#F4F6F8`, violet `#8C83F5`, cyan hanya untuk aktivitas; light/dark; Nuxt UI 4 `app.config.ts`.
- Layar 1: CEO Command Center (sidebar, top bar, pemilih perusahaan, metrik tugas, command composer, approval count, runtime health,
  aktivitas terbaru) dengan fixture `fixtures/demo/*.json` + badge **DEMO** di setiap kartu; state loading/empty/stale/disconnected/denied/failed.
- Flag `NUXT_PUBLIC_OFFICE_MODE=demo|live`; komponen aksi (kirim tugas, cancel, approve) **tidak dirender** di `demo`.
- Screenshot 1440 & 390 via Playwright (Chromium tersedia di sesi ini).
- Layar 2–5 menunggu review Asyam.

### Verifikasi Phase 1
- `npm run typecheck` lolos; test HMAC/replay & isolasi tenant lolos.
- Uji manual dengan runtime Hermes nyata (butuh akses VPS): run dibuat → event masuk → SSE update → stop → `cancelled`.
- Bila VPS belum siap: adapter diuji dengan **fixture deterministik berlabel test** (bukan ditampilkan sebagai live), sesuai PRD §04.
- Mode `demo` di-review: tidak ada request ke `/api/orgs/*/commands` (Network tab).

---

## 10. Keputusan yang gue butuh dari Asyam (approval gate)
1. **Go/no-go Phase 1** sesuai §9.
2. **Repo baru `hermes-office`** + service Railway baru (bukan di `ceo-dashboard`)? (rekomendasi: ya)
3. **Nuxt 4** (bukan Next.js seperti teks PRD) dan **queue Postgres** (bukan Redis) untuk pilot? (rekomendasi: ya)
4. **Versi Hermes di VPS**: kirim output `hermes --version` dan commit (`git -C <dir hermes> rev-parse HEAD`) + konfirmasi API server bisa diaktifkan di jaringan privat.
5. Urutan: Track A dan B paralel, atau Track B (Command Center demo) dulu?
