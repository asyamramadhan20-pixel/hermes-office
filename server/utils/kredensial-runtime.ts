import { and, eq } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { enkripsi, dekripsi, samarkanRahasia } from './crypto'

export const FIELD_RUNTIME = ['api_key', 'outbound_secret'] as const
export type FieldRuntime = typeof FIELD_RUNTIME[number]

export async function simpanKredensialRuntime(runtimeId: string, fieldKey: FieldRuntime, nilai: string, updatedBy: string | null) {
  await useDb().insert(schema.runtimeCredentials).values({
    runtimeId, fieldKey, secretEnc: enkripsi(nilai), maskedPreview: samarkanRahasia(nilai), updatedBy
  }).onConflictDoUpdate({
    target: [schema.runtimeCredentials.runtimeId, schema.runtimeCredentials.fieldKey],
    set: { secretEnc: enkripsi(nilai), maskedPreview: samarkanRahasia(nilai), updatedBy, updatedAt: new Date() }
  })
}

export async function ambilKredensialRuntime(runtimeId: string, fieldKey: FieldRuntime) {
  const [b] = await useDb().select().from(schema.runtimeCredentials)
    .where(and(eq(schema.runtimeCredentials.runtimeId, runtimeId), eq(schema.runtimeCredentials.fieldKey, fieldKey))).limit(1)
  if (!b) return null
  return dekripsi(b.secretEnc)
}
