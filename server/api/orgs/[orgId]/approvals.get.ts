import { and, desc, eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { wajibAnggota, orgIdDariRoute } from '~~/server/utils/tenant'
import type { ApprovalRingkas } from '~~/shared/kontrak'

export default defineEventHandler(async (event): Promise<ApprovalRingkas[]> => {
  const { org } = await wajibAnggota(event, orgIdDariRoute(event))
  const q = getQuery(event)
  const where = q.semua ? eq(schema.approvals.organizationId, org.id) : and(eq(schema.approvals.organizationId, org.id), eq(schema.approvals.status, 'pending'))
  const baris = await useDb().select().from(schema.approvals).where(where).orderBy(desc(schema.approvals.createdAt)).limit(200)
  return baris.map(a => ({ id: a.id, taskId: a.taskId, command: a.command, description: a.description, riskClass: a.riskClass, status: a.status, createdAt: a.createdAt.toISOString() }))
})
