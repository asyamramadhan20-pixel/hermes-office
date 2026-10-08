import { eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { wajibPlatformAdmin } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await wajibPlatformAdmin(event)
  const orgId = getRouterParam(event, 'orgId') ?? ''
  const baris = await useDb().select({ userId: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.organizationMemberships.role, isActive: schema.users.isActive })
    .from(schema.organizationMemberships).innerJoin(schema.users, eq(schema.users.id, schema.organizationMemberships.userId))
    .where(eq(schema.organizationMemberships.organizationId, orgId))
  return baris
})
