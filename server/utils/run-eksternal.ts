import { and, eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { STATUS_TUGAS_TERMINAL, statusTugasDariRun } from '~~/shared/status'

/**
 * Run EKSTERNAL = satu giliran (turn) sesi Hermes yang TIDAK dimulai dari dashboard (Telegram, CLI, dsb.).
 * Fakta Hermes v2026.9.24: `on_session_start` hanya sekali saat system prompt dibangun; `on_session_end`
 * dipanggil tiap pesan (agent/turn_finalizer.py: "run_conversation() runs once per message").
 * Jadi: run dibuka malas (lazy) pada event pertama untuk (profil, session_id) yang belum punya run terbuka,
 * dan ditutup pada `on_session_end`. Satu tugas per sesi (origin='external'), banyak run per tugas.
 * Semuanya dari event asli — tidak ada aktivitas yang disimulasikan (invarian #1).
 */

export async function karyawanDariProfil(organizationId: string, profil: string | null | undefined) {
  if (!profil) return null
  const [k] = await useDb().select().from(schema.aiEmployees)
    .where(and(eq(schema.aiEmployees.organizationId, organizationId), eq(schema.aiEmployees.hermesProfile, profil), eq(schema.aiEmployees.isActive, true))).limit(1)
  return k ?? null
}

export async function bukaRunEksternal(opts: {
  organizationId: string, runtimeId: string, karyawan: typeof schema.aiEmployees.$inferSelect,
  sessionId: string, taskId: string | null, platform: string | null, occurredAt: Date
}) {
  const db = useDb()
  const sekarang = new Date()
  let taskId = opts.taskId
  if (taskId) {
    // Giliran baru pada sesi yang sama: tugas eksternal dibuka lagi (khusus origin external; tugas dashboard tidak pernah dibuka ulang).
    await db.update(schema.tasks).set({ status: 'RUNNING', finishedAt: null, lastError: null, updatedAt: sekarang })
      .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.origin, 'external')))
  } else {
    const kanal = opts.platform ?? 'luar dashboard'
    const [t] = await db.insert(schema.tasks).values({
      organizationId: opts.organizationId, employeeId: opts.karyawan.id, origin: 'external', status: 'RUNNING',
      title: `Sesi ${kanal} · ${opts.karyawan.name}`,
      objective: `Percakapan langsung dengan ${opts.karyawan.name} lewat ${kanal} (sesi Hermes ${opts.sessionId.slice(0, 8)}…). Dibuat otomatis dari event webhook, bukan tugas dari dashboard.`,
      startedAt: opts.occurredAt
    }).returning({ id: schema.tasks.id })
    taskId = t!.id
  }
  const [run] = await db.insert(schema.agentRuns).values({
    organizationId: opts.organizationId, taskId, employeeId: opts.karyawan.id, runtimeId: opts.runtimeId,
    kind: 'external', hermesSessionId: opts.sessionId, status: 'running', startedAt: opts.occurredAt,
    runtimeInfo: { platform: opts.platform ?? null }
  }).returning()
  return run!
}

export async function tutupRunEksternal(run: typeof schema.agentRuns.$inferSelect, status: 'completed' | 'failed' | 'interrupted' | 'unknown', pada: Date, bukti: Record<string, unknown>) {
  const db = useDb()
  const sekarang = new Date()
  // `unknown` juga diberi endedAt supaya event berikutnya membuka run (giliran) baru, bukan menumpang run yang hilang.
  await db.update(schema.agentRuns).set({ status, endedAt: pada, updatedAt: sekarang, lastError: status === 'unknown' ? String(bukti.alasan ?? 'runtime diam') : null })
    .where(eq(schema.agentRuns.id, run.id))
  if (!run.taskId) return
  const statusTugas = statusTugasDariRun(status)
  await db.update(schema.tasks).set({
    status: statusTugas, finishedAt: STATUS_TUGAS_TERMINAL.includes(statusTugas) ? pada : null,
    terminalEvidence: { ...bukti, runStatus: status, runId: run.id }, updatedAt: sekarang
  }).where(and(eq(schema.tasks.id, run.taskId), eq(schema.tasks.origin, 'external')))
}
