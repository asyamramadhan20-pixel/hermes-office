/**
 * Seed organisasi pertama (idempoten, aman dijalankan tiap deploy):
 *   SEED_ORG_SLUG, SEED_ORG_NAME, SEED_ORG_OWNER_EMAIL (default SEED_ADMIN_EMAIL)
 *   SEED_ORG_EMPLOYEES (opsional, JSON array {name, jobTitle, department, specialization?, isSupervisor?})
 * Organisasi dibuat bila slug belum ada; owner ditautkan; AI employee ditambah hanya bila organisasi masih kosong.
 * Dengan --opsional, tanpa SEED_ORG_SLUG → lewati diam-diam.
 */
import postgres from 'postgres'

const opsional = process.argv.includes('--opsional')
const slug = process.env.SEED_ORG_SLUG
const nama = process.env.SEED_ORG_NAME || slug
const emailOwner = process.env.SEED_ORG_OWNER_EMAIL || process.env.SEED_ADMIN_EMAIL
if (!slug) { if (opsional) process.exit(0); console.error('SEED_ORG_SLUG belum diset'); process.exit(1) }
if (!/^[a-z0-9-]{3,40}$/.test(slug)) { console.error('SEED_ORG_SLUG harus huruf kecil/angka/strip, 3–40 karakter'); process.exit(1) }

const BAWAAN = [
  { name: 'MasterCEO', jobTitle: 'Supervisor', department: 'Manajemen', specialization: 'Koordinasi & delegasi tugas ke spesialis', isSupervisor: true },
  { name: 'Rani', jobTitle: 'Spesialis Iklan Meta', department: 'Iklan', specialization: 'Analisis belanja & performa kampanye Meta' },
  { name: 'Nadia', jobTitle: 'Customer Service Lead', department: 'CS', specialization: 'Follow-up pelanggan & template balasan' },
  { name: 'Bima', jobTitle: 'Analis Keuangan', department: 'Keuangan', specialization: 'Rekonsiliasi omset, ongkir, dan retur' },
  { name: 'Sari', jobTitle: 'Koordinator Pengiriman', department: 'Operasional', specialization: 'Pemantauan resi & RTS' }
]
let karyawan = BAWAAN
if (process.env.SEED_ORG_EMPLOYEES) {
  try { karyawan = JSON.parse(process.env.SEED_ORG_EMPLOYEES) } catch { console.error('SEED_ORG_EMPLOYEES bukan JSON sah'); process.exit(1) }
}

const url = process.env.DATABASE_URL
const sql = postgres(url, { max: 1, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require' })
try {
  const [org] = await sql`
    INSERT INTO organizations (slug, name) VALUES (${slug}, ${nama})
    ON CONFLICT (slug) DO UPDATE SET name = organizations.name
    RETURNING id, name`
  if (emailOwner) {
    const [u] = await sql`SELECT id FROM users WHERE lower(email) = ${emailOwner.toLowerCase()} LIMIT 1`
    if (u) {
      await sql`INSERT INTO organization_memberships (organization_id, user_id, role) VALUES (${org.id}, ${u.id}, 'owner')
        ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner'`
    } else {
      console.warn(`… owner ${emailOwner} belum ada di tabel users; jalankan seed-admin dulu.`)
    }
  }
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM ai_employees WHERE organization_id = ${org.id}`
  if (n === 0) {
    for (const k of karyawan) {
      await sql`INSERT INTO ai_employees (organization_id, name, job_title, department, specialization, is_supervisor)
        VALUES (${org.id}, ${k.name}, ${k.jobTitle}, ${k.department || 'Umum'}, ${k.specialization ?? null}, ${!!k.isSupervisor})`
    }
    console.log(`✓ Organisasi "${org.name}" siap dengan ${karyawan.length} AI employee.`)
  } else {
    console.log(`✓ Organisasi "${org.name}" sudah ada (${n} AI employee), tidak diubah.`)
  }
} finally { await sql.end() }
