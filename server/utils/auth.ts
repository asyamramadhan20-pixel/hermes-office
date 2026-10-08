import type { H3Event } from 'h3'
import { hash, verify } from '@node-rs/argon2'
import { eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'

/** argon2id, parameter sama dengan dashboard SSN (tahan GPU & side-channel). */
const OPSI_ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const
export const hashKataSandi = (p: string) => hash(p, OPSI_ARGON)
export async function cekKataSandi(hashTersimpan: string, kandidat: string) {
  try { return await verify(hashTersimpan, kandidat, OPSI_ARGON) } catch { return false }
}
export function validasiPassword(p: string): string | null {
  if (p.length < 10) return 'Password minimal 10 karakter'
  if (/^\d+$/.test(p)) return 'Password tidak boleh hanya angka'
  return null
}
export const MAKS_GAGAL = 5
export const DURASI_KUNCI_MS = 15 * 60 * 1000

export async function catatAudit(opts: {
  organizationId?: string | null
  userId?: string | null
  action: string
  targetType?: string | null
  targetId?: string | null
  detail?: Record<string, unknown> | null
  ip?: string | null
}) {
  await useDb().insert(schema.auditLogs).values({
    organizationId: opts.organizationId ?? null,
    userId: opts.userId ?? null,
    action: opts.action,
    targetType: opts.targetType ?? null,
    targetId: opts.targetId ?? null,
    detail: opts.detail ?? null,
    ip: opts.ip ?? null
  })
}

/** Guard: wajib login; sesi dicek ulang ke DB supaya user nonaktif langsung tertolak. */
export async function wajibLogin(event: H3Event) {
  const sesi = await getUserSession(event)
  const userId = sesi?.user?.id
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Harus login' })
  const [u] = await useDb().select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
  if (!u || !u.isActive) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Sesi tidak berlaku lagi' })
  }
  return u
}

export async function wajibPlatformAdmin(event: H3Event) {
  const u = await wajibLogin(event)
  if (!u.isPlatformAdmin) throw createError({ statusCode: 403, statusMessage: 'Khusus admin platform' })
  return u
}

export const ambilIp = (event: H3Event) =>
  getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
  ?? getRequestIP(event, { xForwardedFor: true })
  ?? null
