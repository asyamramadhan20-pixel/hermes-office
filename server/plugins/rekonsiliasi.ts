import { and, eq, inArray, lt, or, isNull } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { klienUntukOrganisasi, GalatRuntime } from '~~/server/utils/hermes-client'
import { terapkanDariStatus } from '~~/server/utils/perintah'
import { terapkanStatusRun } from '~~/server/utils/status-run'

const INTERVAL_MS = 60_000
const BATAS_TIDAK_DIKETAHUI_MS = 15 * 60_000

/**
 * Rekonsiliasi (PRD §06): outbound webhook Hermes best-effort, jadi run non-terminal dipoll
 * `GET /v1/runs/{id}` tiap menit. Runtime diam ≠ selesai: gagal poll lama → UNKNOWN, bukan COMPLETED.
 * Sekalian menyegarkan /v1/capabilities + status runtime.
 */
export async function rekonsiliasiSekali() {
  const db = useDb()
  const runs = await db.select().from(schema.agentRuns).where(and(
    eq(schema.agentRuns.kind, 'main'),
    inArray(schema.agentRuns.status, ['queued', 'running', 'waiting_for_approval', 'stopping', 'unknown']),
    or(isNull(schema.agentRuns.lastPolledAt), lt(schema.agentRuns.lastPolledAt, new Date(Date.now() - INTERVAL_MS / 2)))
  )).limit(100)
  const perOrg = new Map<string, typeof runs>()
  for (const r of runs) perOrg.set(r.organizationId, [...(perOrg.get(r.organizationId) ?? []), r])

  for (const [orgId, daftar] of perOrg) {
    const ctx = await klienUntukOrganisasi(orgId)
    if (!ctx) continue
    for (const run of daftar) {
      if (!run.hermesRunId) continue
      try {
        const st = await ctx.klien.statusRun(run.hermesRunId)
        await terapkanDariStatus(run.id, st, { sumber: 'poll' })
      } catch (e: any) {
        const umur = Date.now() - (run.lastPolledAt ?? run.createdAt).getTime()
        if (e instanceof GalatRuntime && e.status === 404) {
          // Runtime tidak kenal run ini (restart & retensi habis) → UNKNOWN, bukan gagal; runtime sendiri tetap online.
          await terapkanStatusRun(run.id, 'unknown', { sumber: 'poll', alasan: 'run_not_found' }, { error: 'Runtime tidak lagi mengenali run ini' })
          await db.update(schema.agentRuns).set({ lastPolledAt: new Date() }).where(eq(schema.agentRuns.id, run.id))
          continue
        } else if (umur > BATAS_TIDAK_DIKETAHUI_MS && run.status !== 'unknown') {
          await terapkanStatusRun(run.id, 'unknown', { sumber: 'poll', alasan: 'poll_gagal' }, { error: String(e?.message ?? e).slice(0, 300) })
        }
        await db.update(schema.runtimeInstances).set({ status: 'offline', lastError: String(e?.message ?? e).slice(0, 300) }).where(eq(schema.runtimeInstances.id, ctx.runtime.id))
      }
    }
  }
}

export async function segarkanRuntime() {
  const db = useDb()
  const daftar = await db.select().from(schema.runtimeInstances)
  for (const rt of daftar) {
    const ctx = await klienUntukOrganisasi(rt.organizationId)
    if (!ctx) continue
    try {
      const cap = await ctx.klien.kapabilitas()
      await db.update(schema.runtimeInstances).set({
        capabilities: cap as Record<string, unknown>, status: 'online', lastSeenAt: new Date(), lastError: null,
        hermesVersion: typeof cap.version === 'string' ? cap.version : rt.hermesVersion
      }).where(eq(schema.runtimeInstances.id, rt.id))
    } catch (e: any) {
      await db.update(schema.runtimeInstances).set({ status: 'offline', lastError: String(e?.message ?? e).slice(0, 300) }).where(eq(schema.runtimeInstances.id, rt.id))
    }
  }
}

export default defineNitroPlugin(() => {
  if (useRuntimeConfig().workerNonaktif) return
  let sibuk = false
  const tick = async () => {
    if (sibuk) return
    sibuk = true
    try { await segarkanRuntime(); await rekonsiliasiSekali() } catch (e) { console.error('[rekonsiliasi]', e) } finally { sibuk = false }
  }
  setTimeout(tick, 10_000)
  setInterval(tick, INTERVAL_MS)
})
