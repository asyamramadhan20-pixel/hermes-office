import { eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { hashToken } from '~~/server/utils/crypto'
import { hitungSignatureHermes, signatureCocok, timestampMasihSegar } from '~~/server/utils/webhook-signature'
import { ambilKredensialRuntime } from '~~/server/utils/kredensial-runtime'
import { antreProsesInbox } from '~~/server/utils/hermes-normalisasi'
import { saringBodyHermes, digestBody } from '~~/server/utils/hermes-saring'

const MAKS_BODY = 1_000_000

/**
 * Inbound outbound-webhook Hermes (PRD §06). Urutan:
 *  1. runtime dari hash kunci URL (404 bila tidak ada — jangan bocorkan)
 *  2. HMAC `X-Hermes-Signature-256` atas raw body dengan `outbound_secret` runtime (401)
 *  3. body JSON punya `delivery_id` + `timestamp` segar (±5 mnt) (400/401)
 *  4. simpan body yang SUDAH DISARING (tanpa tool_input/hasil tool; hanya digest raw) ke webhook_inbox SEBELUM ACK
 *     (unik per runtime+delivery_id → 200 duplicate)
 *  5. 202, lalu proses async.
 * Identitas tenant berasal dari runtime (langkah 1), tidak pernah dari body.
 */
export default defineEventHandler(async (event) => {
  const kunci = getRouterParam(event, 'kunci') ?? ''
  const db = useDb()
  const [rt] = await db.select().from(schema.runtimeInstances).where(eq(schema.runtimeInstances.webhookKeyHash, hashToken(kunci))).limit(1)
  if (!rt) throw createError({ statusCode: 404, statusMessage: 'Tidak ditemukan' })

  const raw = (await readRawBody(event, 'utf8')) ?? ''
  if (raw.length > MAKS_BODY) throw createError({ statusCode: 413, statusMessage: 'Body terlalu besar' })

  const secret = await ambilKredensialRuntime(rt.id, 'outbound_secret')
  if (!secret) throw createError({ statusCode: 503, statusMessage: 'Secret outbound runtime belum dipasang' })
  const tanda = getRequestHeader(event, 'x-hermes-signature-256') ?? ''
  const cocok = signatureCocok(hitungSignatureHermes(secret, raw), tanda)
  if (!cocok) throw createError({ statusCode: 401, statusMessage: 'Tanda tangan tidak sah' })

  let body: { delivery_id?: string, timestamp?: string, hook_event_name?: string }
  try { body = JSON.parse(raw) } catch { throw createError({ statusCode: 400, statusMessage: 'JSON tidak sah' }) }
  const deliveryId = body.delivery_id || getRequestHeader(event, 'x-hermes-delivery') || ''
  if (!deliveryId || !body.hook_event_name) throw createError({ statusCode: 400, statusMessage: 'delivery_id / hook_event_name kosong' })
  if (!body.timestamp || !timestampMasihSegar(body.timestamp)) throw createError({ statusCode: 401, statusMessage: 'Timestamp basi' })

  const headers: Record<string, string> = {}
  for (const h of ['x-hermes-event', 'x-hermes-delivery', 'user-agent']) {
    const v = getRequestHeader(event, h); if (v) headers[h] = v
  }
  const [baris] = await db.insert(schema.webhookInbox).values({
    runtimeId: rt.id, organizationId: rt.organizationId, deliveryId, eventName: body.hook_event_name,
    signatureOk: true, body: saringBodyHermes(body as Record<string, unknown>) as unknown as Record<string, unknown>, bodyDigest: digestBody(raw), headers
  }).onConflictDoNothing().returning({ id: schema.webhookInbox.id })

  if (!baris) return { status: 'duplicate', delivery_id: deliveryId }

  setResponseStatus(event, 202)
  // Proses setelah ACK; galat dicatat di inbox.error, bukan dikembalikan ke Hermes.
  event.waitUntil(antreProsesInbox(baris.id))
  return { status: 'accepted', delivery_id: deliveryId }
})
