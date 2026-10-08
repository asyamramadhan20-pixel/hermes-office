import { z } from 'zod'
import { bacaBody } from '~~/server/utils/validasi'
import { useDb, schema } from '~~/server/database/client'
import { wajibAnggota, orgIdDariRoute } from '~~/server/utils/tenant'
import { catatAudit, ambilIp } from '~~/server/utils/auth'
import { PERAN_BOLEH_KELOLA } from '~~/shared/status'

const Body = z.object({
  name: z.string().min(2).max(80), jobTitle: z.string().min(2).max(120), department: z.string().min(2).max(60).default('Umum'),
  specialization: z.string().max(200).optional(), sop: z.string().max(20000).optional(),
  allowedTools: z.array(z.string().max(60)).max(50).default([]), isSupervisor: z.boolean().default(false)
})

/** Registrasi AI employee permanen (REGISTER_AGENT = state control plane, bukan API Hermes). */
export default defineEventHandler(async (event) => {
  const { org, user } = await wajibAnggota(event, orgIdDariRoute(event), PERAN_BOLEH_KELOLA)
  const b = await bacaBody(event, Body)
  const [k] = await useDb().insert(schema.aiEmployees).values({ organizationId: org.id, ...b }).returning()
  await catatAudit({ organizationId: org.id, userId: user.id, action: 'employee.create', targetType: 'ai_employee', targetId: k!.id, ip: ambilIp(event), detail: { name: b.name } })
  return k
})
