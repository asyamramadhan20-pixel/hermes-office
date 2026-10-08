import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

/** Koneksi Postgres tunggal per proses Nitro, dibuat malas supaya build tidak butuh DB. */
export function useDb() {
  if (_db) return _db
  const url = useRuntimeConfig().databaseUrl
  if (!url) throw createError({ statusCode: 500, statusMessage: 'DATABASE_URL belum diset' })
  const lokal = /localhost|127\.0\.0\.1/.test(url)
  _db = drizzle(postgres(url, { max: 5, ssl: lokal ? false : 'require' }), { schema })
  return _db
}

export { schema }
