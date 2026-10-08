import { and, desc, eq, gt } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { wajibAnggota, orgIdDariRoute } from '~~/server/utils/tenant'
import { keEventRingkas } from '~~/server/utils/ringkasan'

/**
 * SSE event tenant. Nitro createEventStream; sumber = tabel task_events (poll DB tiap 2 dtk, cukup untuk pilot).
 * Query `?since=<ISO>` untuk melanjutkan setelah reconnect; tanpa itu mulai dari sekarang.
 */
export default defineEventHandler(async (event) => {
  const { org } = await wajibAnggota(event, orgIdDariRoute(event))
  const q = getQuery(event)
  if (q.json) {
    // Cabang non-stream untuk klien yang hanya butuh daftar terakhir.
    const baris = await useDb().select().from(schema.taskEvents).where(eq(schema.taskEvents.organizationId, org.id))
      .orderBy(desc(schema.taskEvents.occurredAt)).limit(Number(q.limit) > 0 ? Math.min(Number(q.limit), 500) : 100)
    return baris.map(keEventRingkas)
  }
  let sejak = typeof q.since === 'string' && Number.isFinite(Date.parse(q.since)) ? new Date(q.since) : new Date()
  const stream = createEventStream(event)
  const db = useDb()
  const kirim = async () => {
    const baris = await db.select().from(schema.taskEvents)
      .where(and(eq(schema.taskEvents.organizationId, org.id), gt(schema.taskEvents.receivedAt, sejak)))
      .orderBy(desc(schema.taskEvents.receivedAt)).limit(100)
    for (const e of baris.reverse()) {
      await stream.push({ event: 'task_event', id: e.receivedAt.toISOString(), data: JSON.stringify(keEventRingkas(e)) })
      if (e.receivedAt > sejak) sejak = e.receivedAt
    }
  }
  const timer = setInterval(() => { kirim().catch(() => {}) }, 2000)
  const keepalive = setInterval(() => { stream.push({ event: 'keepalive', data: '' }).catch(() => {}) }, 15000)
  stream.onClosed(async () => { clearInterval(timer); clearInterval(keepalive); await stream.close() })
  return stream.send()
})
