import { desc, eq, sql } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { wajibPlatformAdmin } from '~~/server/utils/auth'

/** Daftar organisasi + ringkasan (anggota, AI employee, runtime) untuk halaman admin. */
export default defineEventHandler(async (event) => {
  await wajibPlatformAdmin(event)
  const db = useDb()
  const orgs = await db.select().from(schema.organizations).orderBy(desc(schema.organizations.createdAt))
  const hasil = []
  for (const o of orgs) {
    const [[anggota], [karyawan], [rt], profilTerlihat] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(schema.organizationMemberships).where(eq(schema.organizationMemberships.organizationId, o.id)),
      db.select({ n: sql<number>`count(*)::int` }).from(schema.aiEmployees).where(eq(schema.aiEmployees.organizationId, o.id)),
      db.select().from(schema.runtimeInstances).where(eq(schema.runtimeInstances.organizationId, o.id)).limit(1),
      // Profil Hermes yang pernah mengirim event tapi tidak punya run (belum dipetakan ke AI employee), 30 hari terakhir.
      db.execute<{ profile: string, n: number, terakhir: string }>(sql`
        select data->>'profile' as profile, count(*)::int as n, max(occurred_at) as terakhir from task_events
        where organization_id = ${o.id} and source = 'webhook' and run_id is null and data->>'profile' is not null
          and occurred_at > now() - interval '30 days'
        group by 1 order by 3 desc limit 50`)
    ])
    hasil.push({
      id: o.id, slug: o.slug, name: o.name, isActive: o.isActive, createdAt: o.createdAt.toISOString(),
      anggota: anggota?.n ?? 0, karyawan: karyawan?.n ?? 0,
      profilBelumDipetakan: [...profilTerlihat].map(r => ({ profile: r.profile, n: r.n, terakhir: new Date(r.terakhir).toISOString() })),
      runtime: rt ? { id: rt.id, name: rt.name, baseUrl: rt.baseUrl, status: rt.status, hermesVersion: rt.hermesVersion, lastSeenAt: rt.lastSeenAt?.toISOString() ?? null, lastError: rt.lastError, fitur: (rt.capabilities as { features?: Record<string, boolean> } | null)?.features ?? null } : null
    })
  }
  return hasil
})
