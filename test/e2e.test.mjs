/**
 * Test e2e control plane terhadap server .output + Hermes tiruan (TEST DOUBLE, lihat fixtures/hermes-palsu.mjs).
 * Cakupan PRD §12: isolasi tenant, HMAC valid/palsu/replay/duplikat, alur tugas → run → cancel, approval, UNKNOWN.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import { buatHermesPalsu } from './fixtures/hermes-palsu.mjs'

const BASE = process.env.TEST_BASE_URL
const DB = process.env.DATABASE_URL
const ADMIN = { email: 'admin@test.local', name: 'Admin Test', password: 'rahasia-admin-123' }
const API_KEY = 'kunci-api-hermes-test-1234567890'

function klien() {
  let cookie = ''
  const f = async (path, { method = 'GET', body, headers = {} } = {}) => {
    const res = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
    const set = res.headers.getSetCookie?.() ?? []
    if (set.length) cookie = set.map(c => c.split(';')[0]).join('; ')
    const teks = await res.text()
    let data = null; try { data = teks ? JSON.parse(teks) : null } catch { data = teks }
    return { status: res.status, data }
  }
  return f
}

let admin, hermes, hermesUrl, orgA, orgB, userA, userB, approverA, memberA, runtime, webhookUrl, outboundSecret, karyawanA

before(async () => {
  const r = spawnSync('node', ['scripts/seed-admin.mjs', ADMIN.email, ADMIN.name, ADMIN.password], { env: { ...process.env, DATABASE_URL: DB }, stdio: 'inherit' })
  assert.equal(r.status, 0, 'seed admin')
  admin = klien()
  assert.equal((await admin('/api/auth/login', { method: 'POST', body: { email: ADMIN.email, password: ADMIN.password } })).status, 200)
  orgA = (await admin('/api/admin/orgs', { method: 'POST', body: { slug: 'org-a', name: 'Organisasi A' } })).data
  orgB = (await admin('/api/admin/orgs', { method: 'POST', body: { slug: 'org-b', name: 'Organisasi B' } })).data
  await admin(`/api/admin/orgs/${orgA.id}/members`, { method: 'POST', body: { email: 'ceo-a@test.local', name: 'CEO A', role: 'owner', password: 'password-ceo-a-1' } })
  await admin(`/api/admin/orgs/${orgA.id}/members`, { method: 'POST', body: { email: 'approver-a@test.local', name: 'Approver A', role: 'approver', password: 'password-apr-a-1' } })
  await admin(`/api/admin/orgs/${orgA.id}/members`, { method: 'POST', body: { email: 'staf-a@test.local', name: 'Staf A', role: 'member', password: 'password-staf-a-1' } })
  await admin(`/api/admin/orgs/${orgB.id}/members`, { method: 'POST', body: { email: 'ceo-b@test.local', name: 'CEO B', role: 'owner', password: 'password-ceo-b-1' } })
  userA = klien(); assert.equal((await userA('/api/auth/login', { method: 'POST', body: { email: 'ceo-a@test.local', password: 'password-ceo-a-1' } })).status, 200)
  userB = klien(); assert.equal((await userB('/api/auth/login', { method: 'POST', body: { email: 'ceo-b@test.local', password: 'password-ceo-b-1' } })).status, 200)
  memberA = klien(); assert.equal((await memberA('/api/auth/login', { method: 'POST', body: { email: 'staf-a@test.local', password: 'password-staf-a-1' } })).status, 200)
  approverA = klien(); assert.equal((await approverA('/api/auth/login', { method: 'POST', body: { email: 'approver-a@test.local', password: 'password-apr-a-1' } })).status, 200)

  hermes = buatHermesPalsu({ apiKey: API_KEY, outboundSecret: null })
  hermesUrl = await hermes.mulai()
  const pasang = await admin('/api/admin/runtimes', { method: 'POST', body: { organizationId: orgA.id, baseUrl: hermesUrl, apiKey: API_KEY } })
  assert.equal(pasang.status, 200, JSON.stringify(pasang.data))
  runtime = pasang.data.runtime; webhookUrl = pasang.data.webhookUrl; outboundSecret = pasang.data.outboundSecret
  hermes.outboundUrl = webhookUrl
  // test double perlu tahu secret & url untuk outbound
  Object.assign(hermes, { _secret: outboundSecret })
  karyawanA = (await userA(`/api/orgs/${orgA.id}/employees`, { method: 'POST', body: { name: 'Rani', jobTitle: 'Analis Iklan', department: 'Iklan', sop: 'Jawab singkat.' } })).data
})
after(async () => { await hermes?.tutup() })

const tick = async (q = '') => { const r = await admin(`/api/admin/worker/tick${q}`, { method: 'POST' }); assert.equal(r.status, 200); return r.data }

async function kirimOutbound(hook, { session_id, extra = {}, tool_name = null, tool_input = null, secret = outboundSecret, mutasi = b => b, headersTambahan = {} }) {
  let body = JSON.stringify(mutasi({ hook_event_name: hook, profile: 'default', tool_name, tool_input, session_id, cwd: '/opt/data', extra, delivery_id: randomUUID().replace(/-/g, ''), timestamp: new Date().toISOString() }))
  const sig = 'sha256=' + createHmac('sha256', secret ?? '').update(body).digest('hex')
  const res = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hermes-Event': hook, 'X-Hermes-Signature-256': sig, ...headersTambahan }, body })
  return { status: res.status, data: await res.json().catch(() => null), body: JSON.parse(body) }
}

test('isolasi tenant: B tidak bisa membaca/menulis data A; tanpa login 401', async () => {
  assert.equal((await userB(`/api/orgs/${orgA.id}/ringkasan`)).status, 404)
  assert.equal((await userB(`/api/orgs/${orgA.id}/tasks`)).status, 404)
  assert.equal((await userB(`/api/orgs/${orgA.id}/commands`, { method: 'POST', body: { type: 'ASSIGN_TASK', employeeId: karyawanA.id, title: 'Curang', objective: 'Tujuan uji coba' } })).status, 404)
  assert.equal((await userA(`/api/orgs/${orgB.id}/ringkasan`)).status, 404)
  assert.equal((await klien()(`/api/orgs/${orgA.id}/ringkasan`)).status, 401)
  assert.equal((await userA('/api/admin/orgs', { method: 'POST', body: { slug: 'org-x', name: 'X' } })).status, 403)
  assert.equal((await userA('/api/admin/orgs')).status, 403)
  assert.equal((await userA(`/api/admin/orgs/${orgA.id}/members`)).status, 403)
  // halaman admin: daftar organisasi + ringkasan runtime, daftar anggota
  const daftar = (await admin('/api/admin/orgs')).data
  const a = daftar.find(o => o.id === orgA.id); const b = daftar.find(o => o.id === orgB.id)
  assert.equal(a.anggota, 3); assert.equal(a.karyawan, 1); assert.equal(a.runtime?.baseUrl, hermesUrl)
  assert.equal(b.anggota, 1); assert.equal(b.runtime, null)
  const anggota = (await admin(`/api/admin/orgs/${orgA.id}/members`)).data
  assert.deepEqual(anggota.map(x => x.role).sort(), ['approver', 'member', 'owner'])
  // approver tidak boleh mengirim tugas; owner tidak boleh menjawab approval
  assert.equal((await approverA(`/api/orgs/${orgA.id}/commands`, { method: 'POST', body: { type: 'ASSIGN_TASK', employeeId: karyawanA.id, title: 'Tugas', objective: 'Tujuan uji coba' } })).status, 403)
})

test('runtime: kapabilitas terdeteksi dari /v1/capabilities, bukan ditebak', async () => {
  const sebelum = (await userA(`/api/orgs/${orgA.id}/runtime`)).data
  assert.equal(sebelum.terpasang, true); assert.deepEqual(sebelum.fitur, {})
  await tick()
  const sesudah = (await userA(`/api/orgs/${orgA.id}/runtime`)).data
  assert.equal(sesudah.status, 'online'); assert.equal(sesudah.fitur.run_submission, true); assert.equal(sesudah.hermesVersion, 'test-double')
})

test('webhook: tanda tangan palsu 401, timestamp basi 401, kunci salah 404, duplikat delivery_id ditolak diam-diam', async () => {
  assert.equal((await kirimOutbound('on_session_start', { session_id: 's-x', secret: 'secret-salah-salah-salah' })).status, 401)
  assert.equal((await kirimOutbound('on_session_start', { session_id: 's-x', mutasi: b => ({ ...b, timestamp: new Date(Date.now() - 10 * 60_000).toISOString() }) })).status, 401)
  const salah = await fetch(webhookUrl.replace(/[^/]+$/, 'kunci-ngawur'), { method: 'POST', body: '{}' })
  assert.equal(salah.status, 404)
  const ok = await kirimOutbound('on_session_start', { session_id: 's-dup', extra: { model: 'm', platform: 'api_server' } })
  assert.equal(ok.status, 202); assert.equal(ok.data.status, 'accepted')
  const body = JSON.stringify(ok.body)
  const sig = 'sha256=' + createHmac('sha256', outboundSecret).update(body).digest('hex')
  const ulang = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hermes-Signature-256': sig }, body })
  assert.equal(ulang.status, 200); assert.equal((await ulang.json()).status, 'duplicate')
})

test('alur: ASSIGN_TASK → ACCEPTED (202 Hermes) → poll running → subagent via webhook → completed; B tidak melihat', async () => {
  const kirim = await userA(`/api/orgs/${orgA.id}/commands`, { method: 'POST', body: { type: 'ASSIGN_TASK', employeeId: karyawanA.id, title: 'Rekap iklan', objective: 'Rekap belanja Meta minggu ini', priority: 2 } })
  assert.equal(kirim.status, 200, JSON.stringify(kirim.data))
  assert.equal(kirim.data.command.state, 'QUEUED')
  const taskId = kirim.data.taskId
  let t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  assert.equal(t.tugas.status, 'CREATED'); assert.equal(t.runs.length, 0)

  await tick()
  t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  assert.equal(t.runs.length, 1); assert.ok(t.runs[0].hermesRunId.startsWith('run_'))
  assert.equal(t.tugas.status, 'QUEUED')
  const cmd = (await userA(`/api/orgs/${orgA.id}/commands`)).data.find(c => c.taskId === taskId)
  assert.equal(cmd.state, 'ACCEPTED')
  assert.ok(t.timeline.some(e => e.sourceEventType === 'run.submitted'))

  const runId = t.runs[0].hermesRunId
  const run = hermes.runs.get(runId)
  assert.ok(run.instructions.includes('Rani'), 'SOP/identitas employee dikirim sebagai instructions')
  hermes.setStatus(runId, 'running')
  await tick()
  t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  assert.equal(t.tugas.status, 'RUNNING'); assert.equal(t.runs[0].status, 'running'); assert.equal(t.runs[0].hermesSessionId, run.session_id)

  // Hook subagent_start/stop dari Hermes → run anak, bukan employee baru
  const child = `${run.session_id}_child`
  assert.equal((await kirimOutbound('subagent_start', { session_id: run.session_id, extra: { parent_session_id: run.session_id, parent_turn_id: 't1', parent_subagent_id: null, child_session_id: child, child_subagent_id: 'sa-0-abcdef12', child_role: 'leaf', child_goal: 'Ambil data Meta' } })).status, 202)
  assert.equal((await kirimOutbound('post_tool_call', { session_id: child, tool_name: 'terminal', tool_input: { command: 'curl -H "Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz0123" https://x' }, extra: { status: 'ok', duration_ms: 120 } })).status, 202)
  assert.equal((await kirimOutbound('subagent_stop', { session_id: run.session_id, extra: { parent_session_id: run.session_id, child_session_id: child, child_role: 'leaf', child_status: 'completed', child_summary: 'Selesai', tool_call_history: [{ tool_name: 'terminal', status: 'ok' }], duration_ms: 5000 } })).status, 202)
  await new Promise(r => setTimeout(r, 800))
  t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  const anak = t.runs.find(r => r.kind === 'subagent')
  assert.ok(anak, 'run anak tercatat'); assert.equal(anak.status, 'completed'); assert.equal(anak.parentRunId, t.runs[0].id)
  const ev = t.timeline.find(e => e.sourceEventType === 'tool.completed')
  assert.ok(ev && !JSON.stringify(ev.data).includes('sk-abcdefghijkl'), 'rahasia di tool_input diredaksi')
  assert.equal((await userA(`/api/orgs/${orgA.id}/employees`)).data.length, 1, 'subagent tidak menjadi employee baru')

  hermes.setStatus(runId, 'completed', { output: 'Rekap: Rp12.300.000', usage: { input_tokens: 10, output_tokens: 20 } })
  await tick()
  t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  assert.equal(t.tugas.status, 'COMPLETED'); assert.equal(t.tugas.outputSummary, 'Rekap: Rp12.300.000')
  assert.ok(t.tugas.terminalEvidence?.runStatus === 'completed')
  assert.ok(t.timeline.some(e => e.sourceEventType === 'run.completed' && e.source === 'poll'))

  const ringkasanB = (await userB(`/api/orgs/${orgB.id}/ringkasan`)).data
  assert.equal(ringkasanB.tugas.total, 0); assert.equal(ringkasanB.aktivitasTerbaru.length, 0)
  assert.equal((await userB(`/api/orgs/${orgA.id}/tasks/${taskId}`)).status, 404)
})

test('cancel: CANCEL_REQUESTED sampai runtime konfirmasi cancelled; status terminal tidak ditimpa', async () => {
  const kirim = await userA(`/api/orgs/${orgA.id}/commands`, { method: 'POST', body: { type: 'ASSIGN_TASK', employeeId: karyawanA.id, title: 'Tugas panjang', objective: 'Tugas yang lama sekali' } })
  const taskId = kirim.data.taskId
  await tick()
  let t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  const runId = t.runs[0].hermesRunId
  hermes.setStatus(runId, 'running'); await tick()
  assert.equal((await userA(`/api/orgs/${orgA.id}/commands`, { method: 'POST', body: { type: 'REQUEST_CANCEL', taskId } })).status, 200)
  await tick()
  t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  assert.equal(t.tugas.status, 'CANCEL_REQUESTED', 'belum boleh diklaim batal'); assert.equal(t.runs[0].status, 'stopping')
  hermes.setStatus(runId, 'cancelled'); await tick()
  t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  assert.equal(t.tugas.status, 'CANCELLED')
  // event lama (running) datang terlambat → diabaikan
  hermes.setStatus(runId, 'running'); await tick()
  t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  assert.equal(t.tugas.status, 'CANCELLED'); assert.equal(t.runs[0].status, 'cancelled')
})

test('approval: waiting_for_approval → approver menjawab via /v1/runs/{id}/approval; member ditolak', async () => {
  const kirim = await userA(`/api/orgs/${orgA.id}/commands`, { method: 'POST', body: { type: 'ASSIGN_TASK', employeeId: karyawanA.id, title: 'Butuh izin', objective: 'Hapus file build lama' } })
  const taskId = kirim.data.taskId
  await tick()
  let t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  const runId = t.runs[0].hermesRunId
  hermes.setStatus(runId, 'waiting_for_approval', { approval: { request_id: 'req_1', command: 'rm -rf build', description: 'destruktif' } })
  await tick()
  t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  assert.equal(t.tugas.status, 'WAITING_APPROVAL'); assert.equal(t.approvals.length, 1); assert.equal(t.approvals[0].status, 'pending')
  const ap = t.approvals[0]
  assert.equal((await memberA(`/api/orgs/${orgA.id}/commands`, { method: 'POST', body: { type: 'SUBMIT_APPROVAL', approvalId: ap.id, choice: 'once' } })).status, 403)
  assert.equal((await approverA(`/api/orgs/${orgA.id}/commands`, { method: 'POST', body: { type: 'SUBMIT_APPROVAL', approvalId: ap.id, choice: 'once' } })).status, 200)
  await tick()
  t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  assert.equal(t.approvals[0].status, 'approved'); assert.equal(t.tugas.status, 'RUNNING')
  assert.ok(t.timeline.some(e => e.sourceEventType === 'approval.submitted'))
})

test('runtime hilang / galat: command jaringan → UNKNOWN lalu ulang; run 404 → UNKNOWN (bukan selesai)', async () => {
  const kirim = await userA(`/api/orgs/${orgA.id}/commands`, { method: 'POST', body: { type: 'ASSIGN_TASK', employeeId: karyawanA.id, title: 'Rapuh', objective: 'Tujuan uji coba' } })
  const taskId = kirim.data.taskId
  hermes.suntikGalat(503)
  await tick('?runtime=0')
  let cmd = (await userA(`/api/orgs/${orgA.id}/commands`)).data.find(c => c.taskId === taskId)
  assert.equal(cmd.state, 'UNKNOWN', 'galat 5xx = tidak tahu sampai atau tidak')
  // worker menunggu next_attempt_at (30 dtk) — percepat lewat DB
  spawnSync('psql', [DB, '-q', '-c', `UPDATE commands SET next_attempt_at = now() WHERE task_id = '${taskId}'`])
  await tick()
  cmd = (await userA(`/api/orgs/${orgA.id}/commands`)).data.find(c => c.taskId === taskId)
  assert.equal(cmd.state, 'ACCEPTED')
  let t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  hermes.runs.delete(t.runs[0].hermesRunId)
  await tick()
  t = (await userA(`/api/orgs/${orgA.id}/tasks/${taskId}`)).data
  assert.equal(t.tugas.status, 'UNKNOWN'); assert.equal(t.runs[0].status, 'unknown')
  const ringkasan = (await userA(`/api/orgs/${orgA.id}/ringkasan`)).data
  assert.equal(ringkasan.demo, false); assert.equal(ringkasan.tugas.tidakDiketahui, 1)
})

test('ASSIGN_TASK ditolak bila organisasi belum punya runtime', async () => {
  const kB = (await userB(`/api/orgs/${orgB.id}/employees`, { method: 'POST', body: { name: 'Budi', jobTitle: 'CS', department: 'CS' } })).data
  const kirim = await userB(`/api/orgs/${orgB.id}/commands`, { method: 'POST', body: { type: 'ASSIGN_TASK', employeeId: kB.id, title: 'Tanpa runtime', objective: 'Tujuan uji coba' } })
  await tick()
  const cmd = (await userB(`/api/orgs/${orgB.id}/commands`)).data.find(c => c.taskId === kirim.data.taskId)
  assert.equal(cmd.state, 'REJECTED'); assert.match(cmd.lastError, /belum dipasang/)
})

test('ubah base URL runtime tanpa rotasi kunci: webhook lama tetap diterima, kapabilitas dibaca ulang', async () => {
  assert.equal((await userA(`/api/admin/runtimes/${runtime.id}`, { method: 'PATCH', body: { baseUrl: 'http://127.0.0.1:1' } })).status, 403)
  const mati = await admin(`/api/admin/runtimes/${runtime.id}`, { method: 'PATCH', body: { baseUrl: 'http://127.0.0.1:1/' } })
  assert.equal(mati.status, 200); assert.equal(mati.data.runtime.baseUrl, 'http://127.0.0.1:1'); assert.equal(mati.data.runtime.status, 'unknown')
  assert.equal((await admin(`/api/admin/runtimes/${runtime.id}/probe`, { method: 'POST' })).status, 502)
  assert.equal((await userA(`/api/orgs/${orgA.id}/runtime`)).data.status, 'offline')
  // kembalikan ke runtime uji: probe sukses, dan webhook dengan kunci+secret LAMA masih sah
  const balik = await admin(`/api/admin/runtimes/${runtime.id}`, { method: 'PATCH', body: { baseUrl: hermesUrl, name: 'utama-2' } })
  assert.equal(balik.data.runtime.name, 'utama-2')
  assert.equal((await admin(`/api/admin/runtimes/${runtime.id}/probe`, { method: 'POST' })).data.ok, true)
  const sesudah = (await userA(`/api/orgs/${orgA.id}/runtime`)).data
  assert.equal(sesudah.status, 'online'); assert.equal(sesudah.fitur.run_submission, true)
  const wh = await kirimOutbound('on_session_start', { session_id: 'sesi-setelah-ubah-url' })
  assert.ok(wh.status === 200 || wh.status === 202, `webhook lama harus tetap diterima, dapat ${wh.status}`)
  assert.equal((await admin(`/api/admin/runtimes/${runtime.id}`, { method: 'PATCH', body: {} })).status, 400)
})
