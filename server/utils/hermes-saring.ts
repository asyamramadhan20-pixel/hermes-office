import { createHash } from 'node:crypto'
import { redaksiTeks } from './redaksi'

/**
 * Minimasi data webhook Hermes SEBELUM disimpan (PRD invarian #5).
 * Hermes mengirim SEMUA kwargs hook di `extra` (agent/shell_hooks.py `_payload_fields`): untuk `post_tool_call` itu
 * termasuk `result` (isi file, output terminal, data API); `pre_llm_call` bahkan membawa seluruh `conversation_history`.
 * Control plane hanya butuh metadata, jadi: `tool_input` dibuang, `extra` disaring lewat daftar putih, teks bebas
 * diredaksi + dipotong. Raw body TIDAK disimpan; cukup digest SHA-256 untuk audit (HMAC sudah diverifikasi sebelumnya).
 */

/** Kunci `extra` yang boleh disimpan apa adanya (skalar/metadata). */
const EXTRA_SKALAR = new Set([
  'session_id', 'parent_session_id', 'child_session_id', 'child_subagent_id', 'child_role', 'child_status',
  'delegation_id', 'task_id', 'turn_id', 'run_id',
  'model', 'platform', 'surface', 'completed', 'failed', 'interrupted', 'turn_exit_reason',
  'status', 'duration_ms', 'error_type',
  'pattern_key', 'choice', 'request_id', 'risk_class', 'timeout', 'decision',
  'reason', 'exit_code', 'tool_count', 'turn_count', 'iterations'
])
/** Kunci `extra` berupa teks bebas: diredaksi + dipotong. */
const EXTRA_TEKS: Record<string, number> = {
  child_goal: 500, child_summary: 1000, error_message: 300, command: 300, description: 300, title: 200, summary: 1000
}

export interface BodyTersaring {
  hook_event_name: string
  profile: string | null
  tool_name: string | null
  session_id: string | null
  delivery_id: string
  timestamp: string
  extra: Record<string, unknown>
  /** Nama kunci `extra` yang dibuang (tanpa nilai) — untuk diagnosis. */
  extra_dibuang: string[]
}

function skalar(v: unknown): unknown {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v.length > 200 ? `${v.slice(0, 200)}…` : v
  if (typeof v === 'number' || typeof v === 'boolean') return v
  return String(v).slice(0, 200)
}

export function saringBodyHermes(body: Record<string, unknown>): BodyTersaring {
  const extraMentah = (body.extra && typeof body.extra === 'object' ? body.extra : {}) as Record<string, unknown>
  const extra: Record<string, unknown> = {}
  const dibuang: string[] = []
  for (const [k, v] of Object.entries(extraMentah)) {
    if (EXTRA_SKALAR.has(k)) extra[k] = skalar(v)
    else if (k in EXTRA_TEKS) extra[k] = v == null ? null : redaksiTeks(typeof v === 'string' ? v : JSON.stringify(v), EXTRA_TEKS[k])
    else if (k === 'tool_call_history' && Array.isArray(v)) {
      // Hanya NAMA tool, tanpa argumen/hasil.
      extra.tool_call_history = v.slice(0, 100).map(x => typeof x === 'string' ? x.slice(0, 80)
        : x && typeof x === 'object' ? String((x as Record<string, unknown>).tool_name ?? (x as Record<string, unknown>).name ?? (x as Record<string, unknown>).tool ?? '?').slice(0, 80) : '?')
    } else dibuang.push(k)
  }
  return {
    hook_event_name: String(body.hook_event_name ?? ''),
    profile: typeof body.profile === 'string' ? body.profile.slice(0, 80) : null,
    tool_name: typeof body.tool_name === 'string' ? body.tool_name.slice(0, 120) : null,
    session_id: typeof body.session_id === 'string' && body.session_id ? body.session_id.slice(0, 200) : null,
    delivery_id: String(body.delivery_id ?? ''),
    timestamp: String(body.timestamp ?? ''),
    extra, extra_dibuang: dibuang
  }
}

export function digestBody(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}
