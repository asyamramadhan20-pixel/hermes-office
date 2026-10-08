import { z } from 'zod'
import { bacaBody } from '~~/server/utils/validasi'
import { eq, sql } from 'drizzle-orm'
import { useDb, schema } from '~~/server/database/client'
import { cekKataSandi, catatAudit, ambilIp, MAKS_GAGAL, DURASI_KUNCI_MS } from '~~/server/utils/auth'

const Body = z.object({ email: z.string().email('Email tidak sah'), password: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const { email, password } = await bacaBody(event, Body)
  const db = useDb()
  const ip = ambilIp(event)
  const [user] = await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${email.toLowerCase()}`).limit(1)
  const gagal = () => createError({ statusCode: 401, statusMessage: 'Email atau password salah' })
  if (!user || !user.isActive) throw gagal()
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const menit = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    throw createError({ statusCode: 429, statusMessage: `Akun terkunci sementara. Coba lagi dalam ${menit} menit.` })
  }
  if (!(await cekKataSandi(user.passwordHash, password))) {
    const gagalKe = user.failedLoginCount + 1
    await db.update(schema.users).set({
      failedLoginCount: gagalKe, lockedUntil: gagalKe >= MAKS_GAGAL ? new Date(Date.now() + DURASI_KUNCI_MS) : null
    }).where(eq(schema.users.id, user.id))
    await catatAudit({ userId: user.id, action: 'login.gagal', ip, detail: { gagalKe } })
    throw gagal()
  }
  await db.update(schema.users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(schema.users.id, user.id))
  await setUserSession(event, { user: { id: user.id, email: user.email, name: user.name, isPlatformAdmin: user.isPlatformAdmin } })
  await catatAudit({ userId: user.id, action: 'login.sukses', ip })
  return { success: true }
})
