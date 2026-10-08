import { eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { ambilKredensialRuntime } from './kredensial-runtime'
import type { StatusRun } from '~~/shared/status'

/**
 * Adapter tipis ke Runs API Hermes Agent (terverifikasi di docs/audit-phase0.md §3c):
 *   POST /v1/runs, GET /v1/runs/{id}, POST /v1/runs/{id}/stop, POST /v1/runs/{id}/approval, GET /v1/capabilities
 * Tidak ada mock sukses: tanpa runtime/kredensial → melempar error yang jelas.
 */

export class TidakDidukungRuntime extends Error {
  constructor(fitur: string) { super(`Runtime Hermes tidak mengiklankan fitur "${fitur}" di /v1/capabilities`) }
}
export class GalatRuntime extends Error {
  constructor(public status: number, public kode: string, pesan: string, public body?: unknown) { super(pesan) }
}

export interface Kapabilitas {
  object?: string
  model?: string
  features?: Record<string, boolean>
  [k: string]: unknown
}
export interface StatusRunHermes {
  object?: string
  run_id: string
  status: StatusRun | string
  session_id?: string
  model?: string
  output?: string
  error?: string
  usage?: Record<string, unknown>
  runtime?: Record<string, unknown>
  approval?: Record<string, unknown>
  updated_at?: number
  shutdown_requested_at?: number
  [k: string]: unknown
}

export interface KlienHermes {
  kapabilitas(): Promise<Kapabilitas>
  buatRun(args: { input: string, instructions?: string, sessionId?: string, idempotencyKey: string }): Promise<{ run_id: string, status: string, replayed?: boolean }>
  statusRun(runId: string): Promise<StatusRunHermes>
  hentikanRun(runId: string): Promise<{ run_id?: string, status: string }>
  jawabApproval(runId: string, choice: 'once' | 'session' | 'always' | 'deny', requestId?: string): Promise<{ resolved?: boolean, choice?: string, [k: string]: unknown }>
}

const TIMEOUT_MS = 15_000

export function buatKlienHermes(baseUrl: string, apiKey: string, fetchImpl: typeof fetch = fetch): KlienHermes {
  const base = baseUrl.replace(/\/+$/, '')
  async function panggil<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctl.signal,
        redirect: 'error'
      })
    } catch (e: any) {
      throw new GalatRuntime(0, 'jaringan', `Runtime tidak terjangkau: ${e?.name === 'AbortError' ? 'timeout' : e?.message ?? e}`)
    } finally { clearTimeout(timer) }
    const teks = await res.text()
    let data: any = null
    try { data = teks ? JSON.parse(teks) : null } catch { data = { raw: teks.slice(0, 500) } }
    if (!res.ok) {
      const kode = data?.error?.code ?? data?.code ?? `http_${res.status}`
      const pesan = data?.error?.message ?? data?.message ?? `HTTP ${res.status}`
      throw new GalatRuntime(res.status, String(kode), String(pesan), data)
    }
    return data as T
  }
  return {
    kapabilitas: () => panggil<Kapabilitas>('GET', '/v1/capabilities'),
    buatRun: ({ input, instructions, sessionId, idempotencyKey }) =>
      panggil('POST', '/v1/runs', { input, instructions, session_id: sessionId }, { 'Idempotency-Key': idempotencyKey }),
    statusRun: runId => panggil('GET', `/v1/runs/${encodeURIComponent(runId)}`),
    hentikanRun: runId => panggil('POST', `/v1/runs/${encodeURIComponent(runId)}/stop`, {}),
    jawabApproval: (runId, choice, requestId) =>
      panggil('POST', `/v1/runs/${encodeURIComponent(runId)}/approval`, requestId ? { choice, request_id: requestId } : { choice })
  }
}

/** Fitur yang wajib true di `/v1/capabilities.features` untuk tiap operasi. */
export const FITUR_WAJIB = {
  buatRun: 'run_submission', statusRun: 'run_status', hentikanRun: 'run_stop', jawabApproval: 'run_approval'
} as const

export function pastikanFitur(cap: Record<string, unknown> | null | undefined, fitur: string) {
  const features = (cap as Kapabilitas | null)?.features
  // Kapabilitas belum pernah ditarik → jangan menebak: tolak sampai probe berhasil.
  if (!features || features[fitur] !== true) throw new TidakDidukungRuntime(fitur)
}

/** Klien untuk runtime milik organisasi; null bila runtime/kredensial belum dipasang. */
export async function klienUntukOrganisasi(organizationId: string) {
  const db = useDb()
  const [rt] = await db.select().from(schema.runtimeInstances).where(eq(schema.runtimeInstances.organizationId, organizationId)).limit(1)
  if (!rt) return null
  const apiKey = await ambilKredensialRuntime(rt.id, 'api_key')
  if (!apiKey) return null
  return { runtime: rt, klien: buatKlienHermes(rt.baseUrl, apiKey) }
}
