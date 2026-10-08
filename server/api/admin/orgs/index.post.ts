import { z } from 'zod'
import { bacaBody } from '~~/server/utils/validasi'
import { useDb, schema } from '~~/server/database/client'
import { wajibPlatformAdmin, catatAudit, ambilIp } from '~~/server/utils/auth'

const Body = z.object({ slug: z.string().regex(/^[a-z0-9-]{3,40}$/), name: z.string().min(2).max(120) })

export default defineEventHandler(async (event) => {
  const admin = await wajibPlatformAdmin(event)
  const b = await bacaBody(event, Body)
  const [org] = await useDb().insert(schema.organizations).values(b).returning()
  await catatAudit({ organizationId: org!.id, userId: admin.id, action: 'org.create', targetType: 'organization', targetId: org!.id, ip: ambilIp(event) })
  return org
})
