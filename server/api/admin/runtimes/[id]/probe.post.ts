import { eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { wajibPlatformAdmin } from '~~/server/utils/auth'
import { klienUntukOrganisasi } from '~~/server/utils/hermes-client'

/** Tarik /v1/capabilities sekarang; hasil apa adanya disimpan (tidak ditebak). */
export default defineEventHandler(async (event) => {
  await wajibPlatformAdmin(event)
  const id = getRouterParam(event, 'id') ?? ''
  const db = useDb()
  const [rt] = await db.select().from(schema.runtimeInstances).where(eq(schema.runtimeInstances.id, id)).limit(1)
  if (!rt) throw createError({ statusCode: 404, statusMessage: 'Runtime tidak ditemukan' })
  const ctx = await klienUntukOrganisasi(rt.organizationId)
  if (!ctx) throw createError({ statusCode: 503, statusMessage: 'API key runtime belum dipasang' })
  try {
    const cap = await ctx.klien.kapabilitas()
    await db.update(schema.runtimeInstances).set({ capabilities: cap as Record<string, unknown>, status: 'online', lastSeenAt: new Date(), lastError: null }).where(eq(schema.runtimeInstances.id, id))
    return { ok: true, capabilities: cap }
  } catch (e: any) {
    const pesan = String(e?.message ?? e).slice(0, 300)
    await db.update(schema.runtimeInstances).set({ status: 'offline', lastError: pesan }).where(eq(schema.runtimeInstances.id, id))
    setResponseStatus(event, 502)
    return { ok: false, error: pesan }
  }
})
