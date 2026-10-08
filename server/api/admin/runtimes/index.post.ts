import { z } from 'zod'
import { bacaBody } from '~~/server/utils/validasi'
import { randomBytes } from 'node:crypto'
import { useDb, schema } from '~~/server/database/client'
import { wajibPlatformAdmin, catatAudit, ambilIp } from '~~/server/utils/auth'
import { hashToken } from '~~/server/utils/crypto'
import { simpanKredensialRuntime } from '~~/server/utils/kredensial-runtime'

const Body = z.object({
  organizationId: z.string().uuid(), name: z.string().min(1).max(60).default('utama'),
  baseUrl: z.string().url().refine(u => /^https?:\/\//.test(u), 'http(s) saja'),
  /** API_SERVER_KEY runtime Hermes (≥16 char, syarat Hermes). */
  apiKey: z.string().min(16),
  /** Secret HMAC outbound; kosong = dibuat acak dan dikembalikan sekali. */
  outboundSecret: z.string().min(16).optional()
})

/**
 * Pasang runtime Hermes untuk satu organisasi. Mengembalikan kunci URL webhook + secret outbound SEKALI
 * (hanya hash-nya yang disimpan untuk kunci; secret disimpan terenkripsi).
 */
export default defineEventHandler(async (event) => {
  const admin = await wajibPlatformAdmin(event)
  const b = await bacaBody(event, Body)
  const kunciWebhook = randomBytes(24).toString('base64url')
  const outboundSecret = b.outboundSecret ?? randomBytes(32).toString('base64url')
  const db = useDb()
  const [rt] = await db.insert(schema.runtimeInstances).values({
    organizationId: b.organizationId, name: b.name, baseUrl: b.baseUrl.replace(/\/+$/, ''), webhookKeyHash: hashToken(kunciWebhook)
  }).onConflictDoUpdate({
    target: schema.runtimeInstances.organizationId,
    set: { name: b.name, baseUrl: b.baseUrl.replace(/\/+$/, ''), webhookKeyHash: hashToken(kunciWebhook), status: 'unknown', capabilities: null }
  }).returning()
  await simpanKredensialRuntime(rt!.id, 'api_key', b.apiKey, admin.id)
  await simpanKredensialRuntime(rt!.id, 'outbound_secret', outboundSecret, admin.id)
  await catatAudit({ organizationId: b.organizationId, userId: admin.id, action: 'runtime.upsert', targetType: 'runtime', targetId: rt!.id, ip: ambilIp(event) })
  const appUrl = useRuntimeConfig().public.appUrl
  return {
    runtime: { id: rt!.id, organizationId: rt!.organizationId, baseUrl: rt!.baseUrl },
    /** Tampilkan sekali; tidak bisa diambil lagi. */
    webhookUrl: `${appUrl}/api/webhooks/hermes/${kunciWebhook}`,
    outboundSecret
  }
})
