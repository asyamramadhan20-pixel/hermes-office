import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import type { RingkasanOrg, KaryawanAI, EventRingkas, TugasRingkas, RuntimeRingkas, OrgRingkas } from '~~/shared/kontrak'

const iso = (d: Date | null | undefined) => d ? d.toISOString() : null

export function keEventRingkas(e: typeof schema.taskEvents.$inferSelect): EventRingkas {
  return { id: e.id, taskId: e.taskId, runId: e.runId, sourceEventType: e.sourceEventType, source: e.source, occurredAt: e.occurredAt.toISOString(), data: e.data }
}

export async function ringkasanRuntime(orgId: string): Promise<RuntimeRingkas> {
  const db = useDb()
  const [rt] = await db.select().from(schema.runtimeInstances).where(eq(schema.runtimeInstances.organizationId, orgId)).limit(1)
  const [terakhir] = await db.select({ t: schema.taskEvents.receivedAt }).from(schema.taskEvents)
    .where(and(eq(schema.taskEvents.organizationId, orgId), eq(schema.taskEvents.source, 'webhook'))).orderBy(desc(schema.taskEvents.receivedAt)).limit(1)
  const fitur: Record<string, boolean> = {}
  const f = (rt?.capabilities as { features?: Record<string, unknown> } | null)?.features
  if (f) for (const [k, v] of Object.entries(f)) if (typeof v === 'boolean') fitur[k] = v
  return {
    terpasang: !!rt, name: rt?.name ?? null, status: rt?.status ?? 'unknown', hermesVersion: rt?.hermesVersion ?? null,
    lastSeenAt: iso(rt?.lastSeenAt), lastError: rt?.lastError ?? null, fitur,
    menitSejakEventTerakhir: terakhir ? Math.floor((Date.now() - terakhir.t.getTime()) / 60000) : null
  }
}

export async function daftarKaryawan(orgId: string): Promise<KaryawanAI[]> {
  const db = useDb()
  const karyawan = await db.select().from(schema.aiEmployees).where(eq(schema.aiEmployees.organizationId, orgId)).orderBy(desc(schema.aiEmployees.isSupervisor), schema.aiEmployees.department, schema.aiEmployees.name)
  const aktif = await db.select({ employeeId: schema.agentRuns.employeeId, n: sql<number>`count(*)::int` }).from(schema.agentRuns)
    .where(and(eq(schema.agentRuns.organizationId, orgId), inArray(schema.agentRuns.status, ['queued', 'running', 'waiting_for_approval', 'stopping'])))
    .groupBy(schema.agentRuns.employeeId)
  const perKaryawan = new Map(aktif.map(a => [a.employeeId, a.n]))
  const hasil: KaryawanAI[] = []
  for (const k of karyawan) {
    const [tugas] = await db.select({ id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status }).from(schema.tasks)
      .where(and(eq(schema.tasks.employeeId, k.id), inArray(schema.tasks.status, ['QUEUED', 'ASSIGNED', 'RUNNING', 'WAITING_APPROVAL', 'CANCEL_REQUESTED'])))
      .orderBy(desc(schema.tasks.updatedAt)).limit(1)
    const [ev] = await db.select({ t: schema.taskEvents.occurredAt }).from(schema.taskEvents)
      .innerJoin(schema.agentRuns, eq(schema.agentRuns.id, schema.taskEvents.runId))
      .where(eq(schema.agentRuns.employeeId, k.id)).orderBy(desc(schema.taskEvents.occurredAt)).limit(1)
    hasil.push({
      id: k.id, name: k.name, jobTitle: k.jobTitle, department: k.department, specialization: k.specialization,
      isSupervisor: k.isSupervisor, isActive: k.isActive, hermesProfile: k.hermesProfile, runAktif: perKaryawan.get(k.id) ?? 0,
      terakhirTerlihat: iso(ev?.t), tugasAktif: tugas ?? null
    })
  }
  return hasil
}

export async function daftarTugas(orgId: string, limit = 100): Promise<TugasRingkas[]> {
  const db = useDb()
  const baris = await db.select({ t: schema.tasks, kName: schema.aiEmployees.name }).from(schema.tasks)
    .leftJoin(schema.aiEmployees, eq(schema.aiEmployees.id, schema.tasks.employeeId))
    .where(eq(schema.tasks.organizationId, orgId)).orderBy(desc(schema.tasks.createdAt)).limit(limit)
  const hasil: TugasRingkas[] = []
  for (const { t, kName } of baris) {
    const [run] = await db.select({ id: schema.agentRuns.id, hermesRunId: schema.agentRuns.hermesRunId, status: schema.agentRuns.status }).from(schema.agentRuns)
      .where(and(eq(schema.agentRuns.taskId, t.id), inArray(schema.agentRuns.kind, ['main', 'external']))).orderBy(desc(schema.agentRuns.createdAt)).limit(1)
    hasil.push({
      id: t.id, title: t.title, status: t.status, priority: t.priority, origin: t.origin as 'dashboard' | 'external',
      employee: t.employeeId ? { id: t.employeeId, name: kName ?? '(dihapus)' } : null,
      createdAt: t.createdAt.toISOString(), startedAt: iso(t.startedAt), finishedAt: iso(t.finishedAt),
      outputSummary: t.outputSummary, lastError: t.lastError, runUtama: run ?? null
    })
  }
  return hasil
}

export async function ringkasanOrg(org: OrgRingkas): Promise<RingkasanOrg> {
  const db = useDb()
  const orgId = org.id
  const tujuhHari = new Date(Date.now() - 7 * 86400_000)
  const hitung = async (where: ReturnType<typeof and>) => (await db.select({ n: sql<number>`count(*)::int` }).from(schema.tasks).where(where))[0]!.n
  const t = schema.tasks
  const [events, karyawan, runtime, approvalTertunda] = await Promise.all([
    db.select().from(schema.taskEvents).where(eq(schema.taskEvents.organizationId, orgId)).orderBy(desc(schema.taskEvents.occurredAt)).limit(20),
    daftarKaryawan(orgId), ringkasanRuntime(orgId),
    (await db.select({ n: sql<number>`count(*)::int` }).from(schema.approvals).where(and(eq(schema.approvals.organizationId, orgId), eq(schema.approvals.status, 'pending'))))[0]!.n
  ])
  return {
    demo: false, org, dihitungPada: new Date().toISOString(),
    tugas: {
      total: await hitung(eq(t.organizationId, orgId)),
      berjalan: await hitung(and(eq(t.organizationId, orgId), inArray(t.status, ['QUEUED', 'ASSIGNED', 'RUNNING', 'CANCEL_REQUESTED']))),
      menungguApproval: await hitung(and(eq(t.organizationId, orgId), eq(t.status, 'WAITING_APPROVAL'))),
      selesai7Hari: await hitung(and(eq(t.organizationId, orgId), eq(t.status, 'COMPLETED'), gte(t.finishedAt, tujuhHari))),
      gagal7Hari: await hitung(and(eq(t.organizationId, orgId), eq(t.status, 'FAILED'), gte(t.finishedAt, tujuhHari))),
      tidakDiketahui: await hitung(and(eq(t.organizationId, orgId), eq(t.status, 'UNKNOWN')))
    },
    approvalTertunda, runtime, karyawan, aktivitasTerbaru: events.map(keEventRingkas)
  }
}
