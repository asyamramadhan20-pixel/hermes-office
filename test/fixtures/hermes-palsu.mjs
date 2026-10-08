/**
 * TEST DOUBLE Hermes Agent — HANYA untuk test otomatis. Bukan simulasi produksi.
 * Meniru subset Runs API yang terverifikasi di docs/audit-phase0.md §3c:
 *   GET /v1/capabilities, POST /v1/runs (202, Idempotency-Key), GET /v1/runs/{id},
 *   POST /v1/runs/{id}/stop ({status:"stopping"}), POST /v1/runs/{id}/approval
 * dan mengirim outbound webhook bertanda tangan (X-Hermes-Signature-256) seperti agent/outbound_webhooks.py.
 * Status run diubah oleh test lewat `kontrol.setStatus(runId, status)`.
 */
import http from 'node:http'
import { createHmac, randomUUID } from 'node:crypto'

export function buatHermesPalsu({ apiKey, outboundUrl, outboundSecret }) {
  const runs = new Map()
  const idem = new Map()
  const log = []
  let gagalBerikutnya = null

  async function kirimOutbound(hook, { session_id, tool_name = null, tool_input = null, extra = {} }) {
    if (!outboundUrl) return
    const body = JSON.stringify({ hook_event_name: hook, profile: 'default', tool_name, tool_input, session_id, cwd: '/opt/data',
      extra, delivery_id: randomUUID().replace(/-/g, ''), timestamp: new Date().toISOString() })
    const sig = 'sha256=' + createHmac('sha256', outboundSecret).update(body).digest('hex')
    const res = await fetch(outboundUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hermes-Event': hook, 'X-Hermes-Signature-256': sig }, body })
    log.push({ hook, status: res.status })
    return res
  }

  const server = http.createServer(async (req, res) => {
    const kirim = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)) }
    if (req.headers.authorization !== `Bearer ${apiKey}`) return kirim(401, { error: { code: 'unauthorized', message: 'bad key' } })
    if (gagalBerikutnya) { const g = gagalBerikutnya; gagalBerikutnya = null; return kirim(g, { error: { code: 'injected', message: 'galat disuntik test' } }) }
    let raw = ''; for await (const c of req) raw += c
    const body = raw ? JSON.parse(raw) : {}
    const url = new URL(req.url, 'http://x')
    const m = url.pathname.match(/^\/v1\/runs\/([^/]+)(?:\/(stop|approval|steer))?$/)

    if (req.method === 'GET' && url.pathname === '/v1/capabilities') {
      return kirim(200, { object: 'hermes.api_server.capabilities', platform: 'hermes-agent', model: 'hermes-agent', version: 'test-double',
        auth: { type: 'bearer', required: true },
        features: { chat_completions: true, responses_api: true, run_submission: true, run_status: true, run_events_sse: true, run_stop: true, run_approval_response: true } })
    }
    if (req.method === 'POST' && url.pathname === '/v1/runs') {
      const key = req.headers['idempotency-key']
      if (key && idem.has(key)) { res.setHeader('Idempotency-Replayed', 'true'); return kirim(202, { run_id: idem.get(key), status: 'started', replayed: true }) }
      const run_id = `run_${randomUUID().replace(/-/g, '')}`
      const session_id = body.session_id || `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_000000_${run_id.slice(4, 10)}`
      runs.set(run_id, { object: 'hermes.run', run_id, status: 'queued', session_id, model: 'hermes-agent', input: body.input, instructions: body.instructions ?? null, updated_at: Date.now() / 1000 })
      if (key) idem.set(key, run_id)
      return kirim(202, { run_id, status: 'started' })
    }
    if (m) {
      const run = runs.get(m[1])
      if (!run) return kirim(404, { error: { code: 'run_not_found', message: 'no such run' } })
      if (req.method === 'GET' && !m[2]) return kirim(200, run)
      if (req.method === 'POST' && m[2] === 'stop') {
        if (['completed', 'failed', 'cancelled', 'interrupted'].includes(run.status)) return kirim(200, run)
        run.status = 'stopping'; run.updated_at = Date.now() / 1000
        return kirim(200, { run_id: run.run_id, status: 'stopping' })
      }
      if (req.method === 'POST' && m[2] === 'approval') {
        if (run.status !== 'waiting_for_approval') return kirim(409, { error: { code: 'approval_not_pending', message: 'no pending approval' } })
        run.status = body.choice === 'deny' ? 'running' : 'running'; run.approval = null; run.updated_at = Date.now() / 1000
        return kirim(200, { object: 'hermes.run.approval_response', run_id: run.run_id, choice: body.choice, request_id: body.request_id, resolved: true })
      }
    }
    kirim(404, { error: { code: 'not_found', message: url.pathname } })
  })

  const kontrol = {
    runs, log,
    setStatus(runId, status, tambahan = {}) { const r = runs.get(runId); Object.assign(r, { status, updated_at: Date.now() / 1000 }, tambahan); return r },
    suntikGalat(code) { gagalBerikutnya = code },
    kirimOutbound,
    async mulai(port = 0) { await new Promise(r => server.listen(port, '127.0.0.1', r)); return `http://127.0.0.1:${server.address().port}` },
    async tutup() { await new Promise(r => server.close(r)) }
  }
  return kontrol
}
