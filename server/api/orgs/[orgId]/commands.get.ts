import { desc, eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { wajibAnggota, orgIdDariRoute } from '~~/server/utils/tenant'
import type { PerintahRingkas } from '~~/shared/kontrak'

export default defineEventHandler(async (event): Promise<PerintahRingkas[]> => {
  const { org } = await wajibAnggota(event, orgIdDariRoute(event))
  const baris = await useDb().select().from(schema.commands).where(eq(schema.commands.organizationId, org.id)).orderBy(desc(schema.commands.createdAt)).limit(100)
  return baris.map(c => ({ id: c.id, type: c.type, state: c.state, taskId: c.taskId, lastError: c.lastError, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() }))
})
