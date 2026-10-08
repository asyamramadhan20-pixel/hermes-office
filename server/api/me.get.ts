import { eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { wajibLogin } from '~~/server/utils/auth'

/** Profil + daftar organisasi yang bisa diakses pengguna (untuk pemilih perusahaan). */
export default defineEventHandler(async (event) => {
  const user = await wajibLogin(event)
  const org = await useDb().select({
    id: schema.organizations.id, slug: schema.organizations.slug, name: schema.organizations.name,
    role: schema.organizationMemberships.role
  }).from(schema.organizationMemberships)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.organizationMemberships.organizationId))
    .where(eq(schema.organizationMemberships.userId, user.id))
  return {
    user: { id: user.id, email: user.email, name: user.name, isPlatformAdmin: user.isPlatformAdmin },
    organizations: org
  }
})
