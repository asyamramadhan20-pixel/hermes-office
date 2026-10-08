import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { bacaBody } from '~~/server/utils/validasi'
import { useDb, schema } from '~~/server/database/client'
import { wajibAnggota, orgIdDariRoute } from '~~/server/utils/tenant'
import { catatAudit, ambilIp } from '~~/server/utils/auth'
import { PERAN_BOLEH_KELOLA } from '~~/shared/status'

const Body = z.object({
  name: z.string().min(2).max(80).optional(), jobTitle: z.string().min(2).max(120).optional(), department: z.string().min(2).max(60).optional(),
  specialization: z.string().max(200).nullable().optional(), sop: z.string().max(20000).nullable().optional(),
  isSupervisor: z.boolean().optional(), isActive: z.boolean().optional(),
  /** null = lepas pemetaan profil. */
  hermesProfile: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_.-]+$/, 'huruf/angka/_ . - saja').nullable().optional()
})

/** Ubah AI employee, termasuk pemetaan profil Hermes → employee (unik per organisasi). */
export default defineEventHandler(async (event) => {
  const { org, user } = await wajibAnggota(event, orgIdDariRoute(event), PERAN_BOLEH_KELOLA)
  const employeeId = getRouterParam(event, 'employeeId') ?? ''
  const b = await bacaBody(event, Body)
  const db = useDb()
  const [lama] = await db.select().from(schema.aiEmployees).where(and(eq(schema.aiEmployees.id, employeeId), eq(schema.aiEmployees.organizationId, org.id))).limit(1)
  if (!lama) throw createError({ statusCode: 404, statusMessage: 'AI employee tidak ditemukan' })
  if (b.hermesProfile) {
    const [bentrok] = await db.select({ id: schema.aiEmployees.id, name: schema.aiEmployees.name }).from(schema.aiEmployees)
      .where(and(eq(schema.aiEmployees.organizationId, org.id), eq(schema.aiEmployees.hermesProfile, b.hermesProfile))).limit(1)
    if (bentrok && bentrok.id !== employeeId) throw createError({ statusCode: 409, statusMessage: `Profil "${b.hermesProfile}" sudah dipakai ${bentrok.name}` })
  }
  const [k] = await db.update(schema.aiEmployees).set({ ...b, updatedAt: new Date() }).where(eq(schema.aiEmployees.id, employeeId)).returning()
  await catatAudit({ organizationId: org.id, userId: user.id, action: 'employee.update', targetType: 'ai_employee', targetId: employeeId, ip: ambilIp(event), detail: { diubah: Object.keys(b), hermesProfile: b.hermesProfile } })
  return k
})
