/**
 * Membuat/memperbarui platform admin pertama.
 * Jalankan: npm run seed:admin -- <email> "<nama>" <password>   (atau SEED_ADMIN_* di env)
 */
import { hash } from '@node-rs/argon2'
import postgres from 'postgres'

const opsional = process.argv.includes('--opsional')
const args = process.argv.slice(2).filter(a => a !== '--opsional')
const email = process.env.SEED_ADMIN_EMAIL || args[0]
const nama = process.env.SEED_ADMIN_NAME || args[1]
const password = process.env.SEED_ADMIN_PASSWORD || args[2]
if (opsional && !(email && password)) process.exit(0)
if (!email || !nama || !password) {
  console.error('Pakai: npm run seed:admin -- <email> "<nama>" <password>')
  process.exit(1)
}
if (password.length < 10) { console.error('Password minimal 10 karakter.'); process.exit(1) }

const url = process.env.DATABASE_URL
const sql = postgres(url, { ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require' })
const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 })
await sql`
  INSERT INTO users (email, name, password_hash, is_platform_admin, is_active)
  VALUES (${email}, ${nama}, ${passwordHash}, true, true)
  ON CONFLICT (lower(email)) DO UPDATE
    SET password_hash = ${passwordHash}, name = ${nama}, is_platform_admin = true,
        is_active = true, failed_login_count = 0, locked_until = NULL
`
console.log(`✓ Platform admin siap: ${email}`)
await sql.end()
