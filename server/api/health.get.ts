import { sql } from 'drizzle-orm'
import { useDb } from '~~/server/database/client'

export default defineEventHandler(async (event) => {
  const mulai = Date.now()
  try { await useDb().execute(sql`select 1`) } catch {
    setResponseStatus(event, 503)
    return { status: 'gagal', database: 'tidak terjangkau', waktuMs: Date.now() - mulai }
  }
  return { status: 'ok', database: 'terhubung', waktuMs: Date.now() - mulai, commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null }
})
