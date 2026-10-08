import { randomUUID } from 'node:crypto'
import { and, eq, lte, sql } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { klienUntukOrganisasi, pastikanFitur, FITUR_WAJIB, GalatRuntime, TidakDidukungRuntime, type StatusRunHermes } from './hermes-client'
import { terapkanStatusRun, catatEvent } from './status-run'
import { redaksiTeks } from './redaksi'
import { STATUS_RUN, type StatusRun } from '~~/shared/status'

/**
 * Command bridge (PRD §07): command dipersist dulu (CREATED→QUEUED), worker mengambil dengan
 * FOR UPDATE SKIP LOCKED, mengirim ke Hermes, lalu menandai ACCEPTED/REJECTED/FAILED/UNKNOWN.
 * ACCEPTED = diakui runtime, bukan selesai.
 */

const MAKS_PERCOBAAN = 3
const JEDA_ULANG_MS = 30_000

export async function buatPerintah(opts: {
  organizationId: string, type: 'ASSIGN_TASK' | 'REQUEST_STATUS' | 'REQUEST_CANCEL' | 'SUBMIT_APPROVAL',
  taskId?: string | null, runId?: string | null, payload: Record<string, unknown>, createdBy: string | null, idempotencyKey?: string
}) {
  const [cmd] = await useDb().insert(schema.commands).values({
    organizationId: opts.organizationId, type: opts.type, taskId: opts.taskId ?? null, runId: opts.runId ?? null,
    state: 'QUEUED', idempotencyKey: opts.idempotencyKey ?? `cmd_${randomUUID()}`, correlationId: `corr_${randomUUID()}`,
    payload: opts.payload, createdBy: opts.createdBy
  }).returning()
  return cmd!
}

/** Ambil satu command siap kirim (dikunci) — null bila tidak ada. */
async function ambilSatu() {
  const db = useDb()
  return db.transaction(async (tx) => {
    const baris = await tx.execute<{ id: string }>(sql`
      SELECT id FROM commands
      WHERE state IN ('QUEUED','UNKNOWN') AND next_attempt_at <= now() AND attempts < ${MAKS_PERCOBAAN}
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`)
    const id = (baris as unknown as { id: string }[])[0]?.id
    if (!id) return null
    const [cmd] = await tx.update(schema.commands).set({
      state: 'DISPATCHING', lockedAt: new Date(), attempts: sql`${schema.commands.attempts} + 1`, updatedAt: new Date()
    }).where(eq(schema.commands.id, id)).returning()
    return cmd ?? null
  })
}

function statusRunAman(s: string): StatusRun {
  return (STATUS_RUN as readonly string[]).includes(s) ? s as StatusRun : 'unknown'
}

async function selesaikan(cmdId: string, state: 'ACCEPTED' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'UNKNOWN', result: Record<string, unknown> | null, error?: string | null, ulangi = false) {
  await useDb().update(schema.commands).set({
    state, result, lastError: error ?? null, lockedAt: null, updatedAt: new Date(),
    nextAttemptAt: ulangi ? new Date(Date.now() + JEDA_ULANG_MS) : new Date()
  }).where(eq(schema.commands.id, cmdId))
}

/** Proses satu command. Dipanggil worker; juga bisa dipanggil langsung oleh test. */
export async function prosesPerintah(cmd: typeof schema.commands.$inferSelect) {
  const db = useDb()
  const ctx = await klienUntukOrganisasi(cmd.organizationId)
  if (!ctx) {
    await selesaikan(cmd.id, 'REJECTED', null, 'Runtime Hermes untuk organisasi ini belum dipasang (base URL / API key)')
    return
  }
  const { klien, runtime } = ctx
  const bukti = { sumber: 'command', commandId: cmd.id, correlationId: cmd.correlationId }
  try {
    switch (cmd.type) {
      case 'ASSIGN_TASK': {
        pastikanFitur(runtime.capabilities, FITUR_WAJIB.buatRun)
        if (!cmd.taskId) throw new Error('taskId kosong')
        const [tugas] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, cmd.taskId)).limit(1)
        if (!tugas) throw new Error('Tugas tidak ditemukan')
        const [karyawan] = tugas.employeeId ? await db.select().from(schema.aiEmployees).where(eq(schema.aiEmployees.id, tugas.employeeId)).limit(1) : []
        const instructions = [
          karyawan ? `Kamu adalah ${karyawan.name}, ${karyawan.jobTitle} (${karyawan.department}).` : null,
          karyawan?.sop ? `SOP:\n${karyawan.sop}` : null
        ].filter(Boolean).join('\n\n') || undefined
        const res = await klien.buatRun({ input: `${tugas.title}\n\n${tugas.objective}`, instructions, idempotencyKey: cmd.idempotencyKey })
        // Simpan run utama; replay idempoten → run yang sama.
        const [run] = await db.insert(schema.agentRuns).values({
          organizationId: cmd.organizationId, taskId: tugas.id, employeeId: tugas.employeeId, runtimeId: runtime.id,
          kind: 'main', hermesRunId: res.run_id, status: statusRunAman(res.status === 'started' ? 'queued' : res.status)
        }).onConflictDoUpdate({
          target: [schema.agentRuns.organizationId, schema.agentRuns.hermesRunId], set: { updatedAt: new Date() }
        }).returning()
        await db.update(schema.commands).set({ runId: run!.id }).where(eq(schema.commands.id, cmd.id))
        await db.update(schema.tasks).set({ status: 'QUEUED', updatedAt: new Date() }).where(and(eq(schema.tasks.id, tugas.id), eq(schema.tasks.status, 'CREATED')))
        await catatEvent({ organizationId: cmd.organizationId, taskId: tugas.id, runId: run!.id, runtimeId: runtime.id,
          eventId: `cmd:${cmd.id}:accepted`, source: 'command', sourceEventType: 'run.submitted',
          data: { hermesRunId: res.run_id, replayed: !!res.replayed, correlationId: cmd.correlationId } })
        await selesaikan(cmd.id, 'ACCEPTED', { run_id: res.run_id, status: res.status, replayed: !!res.replayed })
        return
      }
      case 'REQUEST_STATUS':
      case 'REQUEST_CANCEL': {
        pastikanFitur(runtime.capabilities, cmd.type === 'REQUEST_CANCEL' ? FITUR_WAJIB.hentikanRun : FITUR_WAJIB.statusRun)
        const run = await runUtamaTugas(cmd.organizationId, cmd.taskId)
        if (!run?.hermesRunId) { await selesaikan(cmd.id, 'REJECTED', null, 'Tugas belum punya run Hermes'); return }
        if (cmd.type === 'REQUEST_CANCEL') {
          await db.update(schema.tasks).set({ status: 'CANCEL_REQUESTED', updatedAt: new Date() })
            .where(and(eq(schema.tasks.id, run.taskId!), sql`${schema.tasks.status} NOT IN ('COMPLETED','FAILED','CANCELLED')`))
          const res = await klien.hentikanRun(run.hermesRunId)
          await catatEvent({ organizationId: cmd.organizationId, taskId: run.taskId, runId: run.id, runtimeId: runtime.id,
            eventId: `cmd:${cmd.id}:stop`, source: 'command', sourceEventType: 'run.stop_requested', data: { respons: res.status } })
          if (res.status === 'stopping') await terapkanStatusRun(run.id, 'stopping', bukti)
          else if (res.status) await terapkanStatusRun(run.id, statusRunAman(res.status), bukti)
          await selesaikan(cmd.id, 'ACCEPTED', res as Record<string, unknown>)
        } else {
          const st = await klien.statusRun(run.hermesRunId)
          await terapkanDariStatus(run.id, st, { ...bukti, viaPoll: true })
          await selesaikan(cmd.id, 'SUCCEEDED', { status: st.status })
        }
        return
      }
      case 'SUBMIT_APPROVAL': {
        pastikanFitur(runtime.capabilities, FITUR_WAJIB.jawabApproval)
        const approvalId = String(cmd.payload.approvalId ?? '')
        const choice = cmd.payload.choice === 'deny' ? 'deny' : 'once'
        const [ap] = await db.select().from(schema.approvals).where(and(eq(schema.approvals.id, approvalId), eq(schema.approvals.organizationId, cmd.organizationId))).limit(1)
        if (!ap || !ap.runId) { await selesaikan(cmd.id, 'REJECTED', null, 'Approval tidak ditemukan'); return }
        const [run] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, ap.runId)).limit(1)
        const runUtama = run?.kind === 'main' ? run : run?.parentRunId ? (await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, run.parentRunId)).limit(1))[0] : run
        if (!runUtama?.hermesRunId) { await selesaikan(cmd.id, 'REJECTED', null, 'Run Hermes untuk approval ini tidak diketahui'); return }
        const res = await klien.jawabApproval(runUtama.hermesRunId, choice, ap.hermesRequestId ?? undefined)
        await db.update(schema.approvals).set({
          status: choice === 'deny' ? 'denied' : 'approved', choice, decidedBy: cmd.createdBy, decidedAt: new Date()
        }).where(eq(schema.approvals.id, ap.id))
        await catatEvent({ organizationId: cmd.organizationId, taskId: ap.taskId, runId: ap.runId, runtimeId: runtime.id,
          eventId: `cmd:${cmd.id}:approval`, source: 'command', sourceEventType: 'approval.submitted', data: { choice, resolved: res.resolved ?? null } })
        await selesaikan(cmd.id, res.resolved === false ? 'UNKNOWN' : 'SUCCEEDED', res as Record<string, unknown>)
        return
      }
    }
  } catch (e: any) {
    if (e instanceof TidakDidukungRuntime) { await selesaikan(cmd.id, 'REJECTED', null, e.message); return }
    if (e instanceof GalatRuntime) {
      // 4xx = permintaan salah (jangan diulang); 409 approval_not_pending dll juga final.
      if (e.status >= 400 && e.status < 500 && e.status !== 429) { await selesaikan(cmd.id, 'REJECTED', { kode: e.kode }, `${e.kode}: ${redaksiTeks(e.message, 300)}`); return }
      // Jaringan/5xx/429: tidak tahu apakah sampai → UNKNOWN, ulangi terbatas (idempotency key melindungi ASSIGN_TASK).
      const habis = cmd.attempts >= MAKS_PERCOBAAN
      await selesaikan(cmd.id, habis ? 'FAILED' : 'UNKNOWN', { kode: e.kode }, redaksiTeks(e.message, 300), !habis)
      return
    }
    await selesaikan(cmd.id, 'FAILED', null, redaksiTeks(String(e?.message ?? e), 300))
  }
}

async function runUtamaTugas(organizationId: string, taskId: string | null) {
  if (!taskId) return null
  const [r] = await useDb().select().from(schema.agentRuns)
    .where(and(eq(schema.agentRuns.organizationId, organizationId), eq(schema.agentRuns.taskId, taskId), eq(schema.agentRuns.kind, 'main')))
    .orderBy(sql`${schema.agentRuns.createdAt} DESC`).limit(1)
  return r ?? null
}

/** Terapkan objek status `GET /v1/runs/{id}` ke run + tugas, dan catat event poll bila status berubah. */
export async function terapkanDariStatus(runId: string, st: StatusRunHermes, bukti: Record<string, unknown>) {
  const db = useDb()
  const [sebelum] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, runId)).limit(1)
  if (!sebelum) return
  const status = statusRunAman(String(st.status))
  await db.update(schema.agentRuns).set({ lastPolledAt: new Date(), hermesSessionId: sebelum.hermesSessionId ?? st.session_id ?? null }).where(eq(schema.agentRuns.id, runId))
  const hasil = await terapkanStatusRun(runId, status, bukti, {
    output: typeof st.output === 'string' ? redaksiTeks(st.output, 8000) : undefined,
    usage: st.usage ?? undefined, runtimeInfo: st.runtime ?? undefined,
    error: typeof st.error === 'string' ? redaksiTeks(st.error, 500) : undefined
  })
  if (hasil.diterapkan) {
    await catatEvent({ organizationId: sebelum.organizationId, taskId: sebelum.taskId, runId, runtimeId: sebelum.runtimeId,
      eventId: `poll:${runId}:${status}:${st.updated_at ?? Date.now()}`, source: 'poll', sourceEventType: `run.${status}`,
      hermesSessionId: st.session_id ?? null, data: { dari: sebelum.status, usage: st.usage ?? null, runtime: st.runtime ?? null } })
  }
  if (st.status === 'waiting_for_approval' && st.approval && sebelum.taskId) {
    // Pastikan ada approval pending untuk run ini (webhook mungkin tidak sampai).
    const ap = st.approval as Record<string, unknown>
    const [ada] = await db.select({ id: schema.approvals.id }).from(schema.approvals)
      .where(and(eq(schema.approvals.runId, runId), eq(schema.approvals.status, 'pending'))).limit(1)
    if (!ada) await db.insert(schema.approvals).values({
      organizationId: sebelum.organizationId, taskId: sebelum.taskId, runId,
      hermesRequestId: (ap.request_id as string) ?? null, command: redaksiTeks(String(ap.command ?? ap.preview ?? '(perintah)'), 300),
      description: ap.description ? String(ap.description) : null, status: 'pending'
    })
  }
}

/** Satu putaran worker: proses sampai antrean kosong (maks N). */
export async function jalankanWorkerPerintah(maks = 20) {
  let n = 0
  while (n < maks) {
    const cmd = await ambilSatu()
    if (!cmd) break
    await prosesPerintah(cmd)
    n++
  }
  return n
}
