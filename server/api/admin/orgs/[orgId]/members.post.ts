import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { wajibPlatformAdmin, catatAudit, ambilIp, hashKataSandi, validasiPassword } from '~~/server/utils/auth'
import { PERAN_ORG } from '~~/shared/status'

const Body = z.object({
  email: z.string().email(), name: z.string().min(2).max(80), role: z.enum(PERAN_ORG),
  /** Hanya dipakai bila user belum ada. */
  password: z.string().optional()
})

/** Tambah anggota ke organisasi; user baru dibuat bila belum ada. */
export default defineEventHandler(async (event) => {
  const admin = await wajibPlatformAdmin(event)
  const orgId = getRouterParam(event, 'orgId') ?? ''
  const b = Body.parse(await readBody(event))
  const db = useDb()
  let [u] = await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${b.email.toLowerCase()}`).limit(1)
  if (!u) {
    if (!b.password) throw createError({ statusCode: 400, statusMessage: 'User belum ada; sertakan password' })
    const galat = validasiPassword(b.password); if (galat) throw createError({ statusCode: 400, statusMessage: galat })
    ;[u] = await db.insert(schema.users).values({ email: b.email, name: b.name, passwordHash: await hashKataSandi(b.password) }).returning()
  }
  const [m] = await db.insert(schema.organizationMemberships).values({ organizationId: orgId, userId: u!.id, role: b.role })
    .onConflictDoUpdate({ target: [schema.organizationMemberships.organizationId, schema.organizationMemberships.userId], set: { role: b.role } }).returning()
  await catatAudit({ organizationId: orgId, userId: admin.id, action: 'member.upsert', targetType: 'user', targetId: u!.id, ip: ambilIp(event), detail: { role: b.role } })
  return m
})
