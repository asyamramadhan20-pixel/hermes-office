import { eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { STATUS_RUN_TERMINAL, STATUS_TUGAS_TERMINAL, statusTugasDariRun, type StatusRun } from '~~/shared/status'

/**
 * Satu-satunya tempat status run → status tugas berubah. Dipanggil oleh normalizer webhook, rekonsiliasi (poll),
 * dan command bridge. Status terminal tugas tidak pernah ditimpa oleh status non-terminal yang datang terlambat.
 */
export async function terapkanStatusRun(runId: string, statusBaru: StatusRun, bukti: Record<string, unknown>, tambahan: {
  output?: string | null, usage?: Record<string, unknown> | null, runtimeInfo?: Record<string, unknown> | null, error?: string | null
} = {}) {
  const db = useDb()
  const [run] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, runId)).limit(1)
  if (!run) return { run: null, diterapkan: false }
  const sudahTerminal = (STATUS_RUN_TERMINAL as string[]).includes(run.status)
  if (sudahTerminal && !STATUS_RUN_TERMINAL.includes(statusBaru)) return { run, diterapkan: false } // telat: abaikan
  const terminalBaru = STATUS_RUN_TERMINAL.includes(statusBaru)
  const sekarang = new Date()
  await db.update(schema.agentRuns).set({
    status: statusBaru,
    startedAt: run.startedAt ?? (statusBaru === 'running' ? sekarang : null),
    endedAt: terminalBaru ? (run.endedAt ?? sekarang) : run.endedAt,
    output: tambahan.output ?? run.output, usage: tambahan.usage ?? run.usage,
    runtimeInfo: tambahan.runtimeInfo ?? run.runtimeInfo, lastError: tambahan.error ?? run.lastError,
    updatedAt: sekarang
  }).where(eq(schema.agentRuns.id, runId))

  if (run.kind === 'main' && run.taskId) {
    const [tugas] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, run.taskId)).limit(1)
    if (tugas && !STATUS_TUGAS_TERMINAL.includes(tugas.status)) {
      const statusTugas = statusTugasDariRun(statusBaru)
      await db.update(schema.tasks).set({
        status: statusTugas,
        startedAt: tugas.startedAt ?? (statusBaru === 'running' ? sekarang : null),
        finishedAt: STATUS_TUGAS_TERMINAL.includes(statusTugas) ? sekarang : null,
        outputSummary: tambahan.output ?? tugas.outputSummary,
        lastError: tambahan.error ?? tugas.lastError,
        terminalEvidence: STATUS_TUGAS_TERMINAL.includes(statusTugas) ? { ...bukti, runStatus: statusBaru, runId } : tugas.terminalEvidence,
        updatedAt: sekarang
      }).where(eq(schema.tasks.id, tugas.id))
    }
  }
  return { run: { ...run, status: statusBaru }, diterapkan: run.status !== statusBaru }
}

/** Catat event sistem/poll ke task_events (idempoten lewat eventId). */
export async function catatEvent(opts: {
  organizationId: string, taskId?: string | null, runId?: string | null, runtimeId?: string | null,
  eventId: string, source: 'poll' | 'command' | 'system', sourceEventType: string,
  hermesSessionId?: string | null, occurredAt?: Date, data?: Record<string, unknown>
}) {
  await useDb().insert(schema.taskEvents).values({
    organizationId: opts.organizationId, taskId: opts.taskId ?? null, runId: opts.runId ?? null, runtimeId: opts.runtimeId ?? null,
    eventId: opts.eventId, source: opts.source, sourceEventType: opts.sourceEventType, hermesSessionId: opts.hermesSessionId ?? null,
    occurredAt: opts.occurredAt ?? new Date(), data: opts.data ?? {}
  }).onConflictDoNothing()
}
