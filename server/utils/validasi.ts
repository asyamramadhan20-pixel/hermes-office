import type { H3Event } from 'h3'
import { ZodError, type ZodType } from 'zod'

/** Baca + validasi body; galat validasi → 400 dengan daftar masalah, bukan 500. */
export async function bacaBody<T>(event: H3Event, skema: ZodType<T>): Promise<T> {
  const mentah = await readBody(event).catch(() => null)
  try {
    return skema.parse(mentah ?? {})
  } catch (e) {
    if (e instanceof ZodError) {
      throw createError({ statusCode: 400, statusMessage: 'Data tidak sah', data: e.issues.map(i => ({ path: i.path.join('.'), pesan: i.message })) })
    }
    throw e
  }
}
