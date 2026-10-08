import { and, asc, eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { wajibAnggota, orgIdDariRoute } from '~~/server/utils/tenant'
import { keEventRingkas } from '~~/server/utils/ringkasan'

/** Detail tugas: run (utama + subagent), timeline event nyata, approval. */
export default defineEventHandler(async (event) => {
  const { org } = await wajibAnggota(event, orgIdDariRoute(event))
  const taskId = getRouterParam(event, 'taskId') ?? ''
  const db = useDb()
  const [t] = await db.select().from(schema.tasks).where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.organizationId, org.id))).limit(1)
  if (!t) throw createError({ statusCode: 404, statusMessage: 'Tugas tidak ditemukan' })
  const [runs, events, approvals] = await Promise.all([
    db.select().from(schema.agentRuns).where(and(eq(schema.agentRuns.taskId, t.id), eq(schema.agentRuns.organizationId, org.id))).orderBy(asc(schema.agentRuns.createdAt)),
    db.select().from(schema.taskEvents).where(and(eq(schema.taskEvents.taskId, t.id), eq(schema.taskEvents.organizationId, org.id))).orderBy(asc(schema.taskEvents.occurredAt)).limit(500),
    db.select().from(schema.approvals).where(and(eq(schema.approvals.taskId, t.id), eq(schema.approvals.organizationId, org.id))).orderBy(asc(schema.approvals.createdAt))
  ])
  return {
    tugas: { ...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(), startedAt: t.startedAt?.toISOString() ?? null, finishedAt: t.finishedAt?.toISOString() ?? null, deadlineAt: t.deadlineAt?.toISOString() ?? null },
    runs: runs.map(r => ({ id: r.id, kind: r.kind, parentRunId: r.parentRunId, hermesRunId: r.hermesRunId, hermesSessionId: r.hermesSessionId, hermesSubagentId: r.hermesSubagentId,
      status: r.status, startedAt: r.startedAt?.toISOString() ?? null, endedAt: r.endedAt?.toISOString() ?? null, output: r.output, usage: r.usage, runtimeInfo: r.runtimeInfo, lastError: r.lastError, lastPolledAt: r.lastPolledAt?.toISOString() ?? null })),
    timeline: events.map(keEventRingkas),
    approvals: approvals.map(a => ({ id: a.id, taskId: a.taskId, command: a.command, description: a.description, riskClass: a.riskClass, status: a.status, choice: a.choice, createdAt: a.createdAt.toISOString(), decidedAt: a.decidedAt?.toISOString() ?? null }))
  }
})
