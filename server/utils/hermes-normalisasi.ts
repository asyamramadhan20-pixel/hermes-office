import { and, eq, isNull } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { redaksiObjek, redaksiTeks } from './redaksi'
import { terapkanStatusRun } from './status-run'

/**
 * Normalisasi event mentah outbound webhook Hermes → `task_events` (PRD §06).
 * Bentuk body (agent/outbound_webhooks.py): { hook_event_name, profile, tool_name, tool_input, session_id, cwd,
 *   extra: {...kwargs hook}, delivery_id, timestamp }
 * Pemetaan nama mengikuti docs/audit-phase0.md §4. Event yang tidak dikenal tetap disimpan apa adanya
 * sebagai `hermes.<nama>` supaya tidak ada data hilang, tapi tidak mengubah status apa pun.
 */

export interface BodyHermes {
  hook_event_name: string
  profile?: string
  tool_name?: string | null
  tool_input?: unknown
  session_id?: string | null
  cwd?: string | null
  extra?: Record<string, unknown>
  delivery_id: string
  timestamp: string
}

const PETA: Record<string, string> = {
  on_session_start: 'session.started',
  on_session_end: 'session.turn_ended',
  subagent_start: 'subagent.started',
  subagent_stop: 'subagent.finished',
  pre_tool_call: 'tool.started',
  post_tool_call: 'tool.completed',
  pre_approval_request: 'approval.requested',
  post_approval_response: 'approval.resolved',
  kanban_task_claimed: 'kanban.task.claimed',
  kanban_task_completed: 'kanban.task.completed',
  kanban_task_blocked: 'kanban.task.blocked'
}

export function petakanNamaEvent(hook: string) {
  return PETA[hook] ?? `hermes.${hook}`
}

/** Cari run berdasarkan session Hermes di organisasi ini. */
async function runDariSession(organizationId: string, sessionId: string | null | undefined) {
  if (!sessionId) return null
  const [r] = await useDb().select().from(schema.agentRuns)
    .where(and(eq(schema.agentRuns.organizationId, organizationId), eq(schema.agentRuns.hermesSessionId, sessionId))).limit(1)
  return r ?? null
}

/** Pemrosesan inbox dijalankan serial per proses supaya urutan event (mis. subagent_start → post_tool_call) terjaga. */
let antrean: Promise<void> = Promise.resolve()
export function antreProsesInbox(inboxId: string) {
  antrean = antrean.then(() => prosesInboxHermes(inboxId)).catch(e => { console.error('[inbox]', e) })
  return antrean
}

export async function prosesInboxHermes(inboxId: string) {
  const db = useDb()
  const [inbox] = await db.select().from(schema.webhookInbox).where(eq(schema.webhookInbox.id, inboxId)).limit(1)
  if (!inbox || inbox.processedAt) return
  try {
    const body = JSON.parse(inbox.rawBody) as BodyHermes
    const extra = (body.extra ?? {}) as Record<string, unknown>
    const jenis = petakanNamaEvent(body.hook_event_name)
    const occurredAt = Number.isFinite(Date.parse(body.timestamp)) ? new Date(body.timestamp) : inbox.receivedAt
    const sessionId = body.session_id ?? (extra.session_id as string | undefined) ?? null

    let run = await runDariSession(inbox.organizationId, sessionId)
    let data: Record<string, unknown> = { hook: body.hook_event_name, profile: body.profile ?? null }

    switch (body.hook_event_name) {
      case 'subagent_start': {
        const parent = await runDariSession(inbox.organizationId, extra.parent_session_id as string)
        const childSession = (extra.child_session_id as string | null) ?? null
        data = { ...data, parentSessionId: extra.parent_session_id ?? null, childSessionId: childSession,
          childSubagentId: extra.child_subagent_id ?? null, childRole: extra.child_role ?? null,
          childGoal: redaksiTeks(String(extra.child_goal ?? ''), 500) }
        // Subagent = run anak, BUKAN AI employee baru (PRD §08).
        const [anak] = await db.insert(schema.agentRuns).values({
          organizationId: inbox.organizationId, taskId: parent?.taskId ?? null, employeeId: parent?.employeeId ?? null,
          runtimeId: inbox.runtimeId, parentRunId: parent?.id ?? null, kind: 'subagent',
          hermesSessionId: childSession, hermesSubagentId: (extra.child_subagent_id as string) ?? null,
          status: 'running', startedAt: occurredAt
        }).returning()
        run = anak ?? null
        break
      }
      case 'subagent_stop': {
        const childSession = (extra.child_session_id as string | null) ?? null
        run = await runDariSession(inbox.organizationId, childSession) ?? run
        const statusAnak = String(extra.child_status ?? 'unknown')
        data = { ...data, childSessionId: childSession, childStatus: statusAnak, durationMs: extra.duration_ms ?? null,
          childSummary: redaksiTeks(String(extra.child_summary ?? ''), 1000),
          toolCallHistory: redaksiObjek(extra.tool_call_history ?? []) }
        if (run && run.kind === 'subagent') {
          const peta: Record<string, 'completed' | 'failed' | 'interrupted'> = { completed: 'completed', failed: 'failed', error: 'failed', interrupted: 'interrupted' }
          await db.update(schema.agentRuns).set({
            status: peta[statusAnak] ?? 'unknown', endedAt: occurredAt,
            output: redaksiTeks(String(extra.child_summary ?? ''), 4000), updatedAt: new Date()
          }).where(eq(schema.agentRuns.id, run.id))
        }
        break
      }
      case 'on_session_start':
        data = { ...data, model: extra.model ?? null, platform: extra.platform ?? null }
        break
      case 'on_session_end':
        data = { ...data, completed: extra.completed ?? null, failed: extra.failed ?? null, interrupted: extra.interrupted ?? null,
          turnExitReason: extra.turn_exit_reason ?? null, model: extra.model ?? null }
        // Akhir turn ≠ akhir run; status run hanya dari /v1/runs. Tidak mengubah status di sini.
        break
      case 'pre_tool_call':
      case 'post_tool_call':
        data = { ...data, toolName: body.tool_name ?? null, status: extra.status ?? null, durationMs: extra.duration_ms ?? null,
          errorType: extra.error_type ?? null, errorMessage: extra.error_message ? redaksiTeks(String(extra.error_message), 300) : null,
          // Argumen tool SELALU diredaksi dan dipotong sebelum disimpan.
          toolInputPreview: redaksiTeks(JSON.stringify(body.tool_input ?? null), 300) }
        break
      case 'pre_approval_request':
      case 'post_approval_response': {
        data = { ...data, command: redaksiTeks(String(extra.command ?? ''), 300), description: extra.description ?? null,
          patternKey: extra.pattern_key ?? null, surface: extra.surface ?? null, choice: extra.choice ?? null, requestId: extra.request_id ?? null }
        if (body.hook_event_name === 'pre_approval_request' && run) {
          await db.insert(schema.approvals).values({
            organizationId: inbox.organizationId, taskId: run.taskId, runId: run.id,
            hermesRequestId: (extra.request_id as string) ?? null, command: String(data.command),
            description: extra.description ? String(extra.description) : null, status: 'pending'
          })
        }
        if (body.hook_event_name === 'post_approval_response' && run) {
          const choice = String(extra.choice ?? '')
          const status = ['once', 'session', 'always', 'smart_approve'].includes(choice) ? 'approved'
            : ['deny', 'smart_deny'].includes(choice) ? 'denied' : ['timeout', 'cancelled', 'notify_failed'].includes(choice) ? 'expired' : 'unknown'
          await db.update(schema.approvals).set({ status, choice, decidedAt: occurredAt })
            .where(and(eq(schema.approvals.runId, run.id), eq(schema.approvals.status, 'pending'), isNull(schema.approvals.decidedBy)))
        }
        break
      }
      default:
        data = { ...data, extra: redaksiObjek(extra) as Record<string, unknown> }
    }

    await db.insert(schema.taskEvents).values({
      organizationId: inbox.organizationId, taskId: run?.taskId ?? null, runId: run?.id ?? null, runtimeId: inbox.runtimeId,
      eventId: `hermes:${inbox.deliveryId}`, source: 'webhook', sourceEventType: jenis, hermesSessionId: sessionId,
      occurredAt, data
    }).onConflictDoNothing()

    // Tugas yang sedang WAITING_APPROVAL/RUNNING: sinkronkan ringan dari event approval.
    if (run?.taskId && body.hook_event_name === 'pre_approval_request') {
      await terapkanStatusRun(run.id, 'waiting_for_approval', { sumber: 'webhook', eventId: `hermes:${inbox.deliveryId}` })
    }

    await db.update(schema.runtimeInstances).set({ lastSeenAt: new Date(), status: 'online' }).where(eq(schema.runtimeInstances.id, inbox.runtimeId))
    await db.update(schema.webhookInbox).set({ processedAt: new Date() }).where(eq(schema.webhookInbox.id, inbox.id))
  } catch (e: any) {
    await db.update(schema.webhookInbox).set({ processedAt: new Date(), error: String(e?.message ?? e).slice(0, 500) })
      .where(eq(schema.webhookInbox.id, inbox.id))
  }
}
