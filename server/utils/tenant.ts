import type { H3Event } from 'h3'
import { and, eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { wajibLogin } from './auth'
import { PERAN_ORG, type PeranOrg } from '~~/shared/status'

const URUTAN_PERAN: Record<PeranOrg, number> = { auditor: 0, member: 1, approver: 1, manager: 2, owner: 3 }

/**
 * Guard tenant. Semua endpoint `/api/orgs/:orgId/*` WAJIB lewat sini.
 * - 404 (bukan 403) bila bukan anggota: jangan bocorkan bahwa organisasi itu ada.
 * - `peranDiizinkan` eksplisit (daftar), bukan "minimal", supaya `approver` tidak otomatis dapat hak `member`.
 * Platform admin TIDAK otomatis jadi anggota tenant (akses data tenant harus lewat keanggotaan eksplisit).
 */
export async function wajibAnggota(event: H3Event, orgId: string, peranDiizinkan: readonly PeranOrg[] = PERAN_ORG) {
  const user = await wajibLogin(event)
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) throw createError({ statusCode: 404, statusMessage: 'Organisasi tidak ditemukan' })
  const db = useDb()
  const [baris] = await db.select({
    role: schema.organizationMemberships.role,
    org: schema.organizations
  }).from(schema.organizationMemberships)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.organizationMemberships.organizationId))
    .where(and(
      eq(schema.organizationMemberships.organizationId, orgId),
      eq(schema.organizationMemberships.userId, user.id)
    )).limit(1)
  if (!baris || !baris.org.isActive) throw createError({ statusCode: 404, statusMessage: 'Organisasi tidak ditemukan' })
  if (!peranDiizinkan.includes(baris.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Peran Anda tidak diizinkan untuk aksi ini' })
  }
  return { user, org: baris.org, role: baris.role }
}

export const peranLebihTinggi = (a: PeranOrg, b: PeranOrg) => URUTAN_PERAN[a] > URUTAN_PERAN[b]

/** Ambil `orgId` dari route param dan pastikan ada. */
export function orgIdDariRoute(event: H3Event) {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) throw createError({ statusCode: 404, statusMessage: 'Organisasi tidak ditemukan' })
  return orgId
}
