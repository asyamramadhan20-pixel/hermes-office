import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { bacaBody } from '~~/server/utils/validasi'
import { useDb, schema } from '~~/server/database/client'
import { wajibPlatformAdmin, catatAudit, ambilIp } from '~~/server/utils/auth'
import { simpanKredensialRuntime } from '~~/server/utils/kredensial-runtime'

const Body = z.object({
  name: z.string().min(1).max(60).optional(),
  baseUrl: z.string().url().refine(u => /^https?:\/\//.test(u), 'http(s) saja').optional(),
  /** Ganti API_SERVER_KEY saja (opsional); kunci webhook & secret outbound TIDAK dirotasi. */
  apiKey: z.string().min(16).optional()
}).refine(b => b.name !== undefined || b.baseUrl !== undefined || b.apiKey !== undefined, 'Tidak ada yang diubah')

/**
 * Ubah koneksi runtime (base URL / nama / API key) TANPA merotasi kunci URL webhook dan secret HMAC,
 * jadi config.yaml + .env di sisi Hermes tidak perlu disentuh (mis. saat tunnel dipasang).
 * Kapabilitas dikosongkan agar dibaca ulang dari runtime di alamat baru, bukan ditebak.
 */
export default defineEventHandler(async (event) => {
  const admin = await wajibPlatformAdmin(event)
  const id = getRouterParam(event, 'id') ?? ''
  const b = await bacaBody(event, Body)
  const db = useDb()
  const [lama] = await db.select().from(schema.runtimeInstances).where(eq(schema.runtimeInstances.id, id)).limit(1)
  if (!lama) throw createError({ statusCode: 404, statusMessage: 'Runtime tidak ditemukan' })
  const baseUrl = b.baseUrl !== undefined ? b.baseUrl.replace(/\/+$/, '') : lama.baseUrl
  const [rt] = await db.update(schema.runtimeInstances).set({
    name: b.name ?? lama.name, baseUrl,
    ...(baseUrl !== lama.baseUrl || b.apiKey ? { status: 'unknown' as const, capabilities: null, lastError: null } : {})
  }).where(eq(schema.runtimeInstances.id, id)).returning()
  if (b.apiKey) await simpanKredensialRuntime(id, 'api_key', b.apiKey, admin.id)
  await catatAudit({
    organizationId: lama.organizationId, userId: admin.id, action: 'runtime.update', targetType: 'runtime', targetId: id, ip: ambilIp(event),
    detail: { baseUrlLama: lama.baseUrl, baseUrl, apiKeyDiganti: !!b.apiKey }
  })
  return { runtime: { id: rt!.id, organizationId: rt!.organizationId, name: rt!.name, baseUrl: rt!.baseUrl, status: rt!.status } }
})
