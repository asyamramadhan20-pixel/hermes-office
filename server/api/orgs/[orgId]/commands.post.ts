import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { wajibAnggota, orgIdDariRoute } from '~~/server/utils/tenant'
import { catatAudit, ambilIp } from '~~/server/utils/auth'
import { buatPerintah } from '~~/server/utils/perintah'
import { PERAN_BOLEH_PERINTAH, PERAN_BOLEH_APPROVAL } from '~~/shared/status'

const Body = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ASSIGN_TASK'), employeeId: z.string().uuid(), title: z.string().min(3).max(200), objective: z.string().min(3).max(20000), priority: z.number().int().min(1).max(5).default(3) }),
  z.object({ type: z.literal('REQUEST_CANCEL'), taskId: z.string().uuid() }),
  z.object({ type: z.literal('REQUEST_STATUS'), taskId: z.string().uuid() }),
  z.object({ type: z.literal('SUBMIT_APPROVAL'), approvalId: z.string().uuid(), choice: z.enum(['once', 'deny']) })
])

/**
 * Satu pintu untuk semua command (PRD §07). Dipersist dulu, dikirim oleh worker.
 * Respons = command dalam state QUEUED; UI tidak boleh menampilkan "berjalan" sampai ada event ACCEPTED/run.*.
 */
export default defineEventHandler(async (event) => {
  const orgId = orgIdDariRoute(event)
  const b = Body.parse(await readBody(event))
  const peran = b.type === 'SUBMIT_APPROVAL' ? PERAN_BOLEH_APPROVAL : PERAN_BOLEH_PERINTAH
  const { org, user } = await wajibAnggota(event, orgId, peran)
  const db = useDb()
  const ip = ambilIp(event)

  if (b.type === 'ASSIGN_TASK') {
    const [k] = await db.select().from(schema.aiEmployees).where(and(eq(schema.aiEmployees.id, b.employeeId), eq(schema.aiEmployees.organizationId, org.id), eq(schema.aiEmployees.isActive, true))).limit(1)
    if (!k) throw createError({ statusCode: 404, statusMessage: 'AI employee tidak ditemukan' })
    const [t] = await db.insert(schema.tasks).values({ organizationId: org.id, employeeId: k.id, createdBy: user.id, title: b.title, objective: b.objective, priority: b.priority, status: 'CREATED' }).returning()
    const cmd = await buatPerintah({ organizationId: org.id, type: 'ASSIGN_TASK', taskId: t!.id, payload: { employeeId: k.id }, createdBy: user.id })
    await catatAudit({ organizationId: org.id, userId: user.id, action: 'command.assign_task', targetType: 'task', targetId: t!.id, ip, detail: { commandId: cmd.id } })
    return { command: cmd, taskId: t!.id }
  }
  if (b.type === 'REQUEST_CANCEL' || b.type === 'REQUEST_STATUS') {
    const [t] = await db.select().from(schema.tasks).where(and(eq(schema.tasks.id, b.taskId), eq(schema.tasks.organizationId, org.id))).limit(1)
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Tugas tidak ditemukan' })
    const cmd = await buatPerintah({ organizationId: org.id, type: b.type, taskId: t.id, payload: {}, createdBy: user.id })
    await catatAudit({ organizationId: org.id, userId: user.id, action: `command.${b.type.toLowerCase()}`, targetType: 'task', targetId: t.id, ip, detail: { commandId: cmd.id } })
    return { command: cmd, taskId: t.id }
  }
  const [ap] = await db.select().from(schema.approvals).where(and(eq(schema.approvals.id, b.approvalId), eq(schema.approvals.organizationId, org.id))).limit(1)
  if (!ap) throw createError({ statusCode: 404, statusMessage: 'Approval tidak ditemukan' })
  if (ap.status !== 'pending') throw createError({ statusCode: 409, statusMessage: 'Approval sudah diputuskan' })
  const cmd = await buatPerintah({ organizationId: org.id, type: 'SUBMIT_APPROVAL', taskId: ap.taskId, runId: ap.runId, payload: { approvalId: ap.id, choice: b.choice }, createdBy: user.id })
  await catatAudit({ organizationId: org.id, userId: user.id, action: 'command.submit_approval', targetType: 'approval', targetId: ap.id, ip, detail: { commandId: cmd.id, choice: b.choice } })
  return { command: cmd, taskId: ap.taskId }
})
