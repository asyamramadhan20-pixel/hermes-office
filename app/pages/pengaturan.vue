<script setup lang="ts">
/**
 * Pengaturan. Untuk platform admin: kelola organisasi, anggota, AI employee, dan pasang runtime Hermes
 * (hasil registrasi — URL webhook + secret HMAC — tampil SEKALI, lalu tidak bisa diambil lagi).
 * Mode demo: hanya menampilkan petunjuk, tidak ada aksi.
 */
import { PERAN_ORG } from '~~/shared/status'
import type { KaryawanAI } from '~~/shared/kontrak'

useHead({ title: 'Pengaturan' })
const { demo, profil } = useOffice()
const { data: profilSaya } = await profil()
const toast = useToast()
const ambil = useRequestFetch()
const adminPlatform = computed(() => !!profilSaya.value?.user.isPlatformAdmin)

interface OrgAdmin {
  id: string, slug: string, name: string, isActive: boolean, createdAt: string, anggota: number, karyawan: number
  /** Profil Hermes yang mengirim event tapi belum dipetakan ke AI employee. */
  profilBelumDipetakan: { profile: string, n: number, terakhir: string }[]
  runtime: { id: string, name: string, baseUrl: string, status: string, hermesVersion: string | null, lastSeenAt: string | null, lastError: string | null, fitur: Record<string, boolean> | null } | null
}
const { data: orgs, refresh: segarkanOrg, pending: memuatOrg } = await useAsyncData<OrgAdmin[]>('admin.orgs', () => demo || !adminPlatform.value ? Promise.resolve([]) : ambil<OrgAdmin[]>('/api/admin/orgs'), { watch: [adminPlatform], default: () => [] })
const orgTerpilih = ref<string | undefined>(undefined)
watch(orgs, (d) => { if (d.length && !d.some(o => o.id === orgTerpilih.value)) orgTerpilih.value = d[0]!.id }, { immediate: true })
const org = computed(() => orgs.value.find(o => o.id === orgTerpilih.value) ?? null)
const pilihanOrg = computed(() => orgs.value.map(o => ({ label: `${o.name} (${o.slug})`, value: o.id })))

function galat(e: unknown) {
  const d = (e as { data?: { statusMessage?: string, data?: { pesan: string, path: string }[] } })?.data
  return d?.data?.map(x => `${x.path}: ${x.pesan}`).join('; ') || d?.statusMessage || (e instanceof Error ? e.message : String(e))
}

/* ── organisasi baru ── */
const orgBaru = reactive({ slug: '', name: '' })
const simpanOrg = ref(false)
async function buatOrg() {
  simpanOrg.value = true
  try {
    const o = await $fetch<OrgAdmin>('/api/admin/orgs', { method: 'POST', body: orgBaru })
    toast.add({ title: 'Organisasi dibuat', description: o.name, color: 'success', icon: 'i-lucide-check' })
    orgBaru.slug = ''; orgBaru.name = ''
    await segarkanOrg(); orgTerpilih.value = o.id
  } catch (e) { toast.add({ title: 'Gagal membuat organisasi', description: galat(e), color: 'error', icon: 'i-lucide-triangle-alert' }) } finally { simpanOrg.value = false }
}

/* ── anggota ── */
interface Anggota { userId: string, email: string, name: string, role: string, isActive: boolean }
const { data: anggota, refresh: segarkanAnggota } = await useAsyncData<Anggota[]>(() => `admin.anggota.${orgTerpilih.value ?? 'none'}`, () => orgTerpilih.value && !demo ? ambil<Anggota[]>(`/api/admin/orgs/${orgTerpilih.value}/members`) : Promise.resolve([]), { watch: [orgTerpilih], default: () => [] })
const anggotaBaru = reactive({ email: '', name: '', role: 'member' as (typeof PERAN_ORG)[number], password: '' })
const simpanAnggota = ref(false)
async function tambahAnggota() {
  if (!orgTerpilih.value) return
  simpanAnggota.value = true
  try {
    await $fetch(`/api/admin/orgs/${orgTerpilih.value}/members`, { method: 'POST', body: { ...anggotaBaru, password: anggotaBaru.password || undefined } })
    toast.add({ title: 'Anggota disimpan', description: `${anggotaBaru.email} sebagai ${anggotaBaru.role}`, color: 'success', icon: 'i-lucide-check' })
    anggotaBaru.email = ''; anggotaBaru.name = ''; anggotaBaru.password = ''
    await Promise.all([segarkanAnggota(), segarkanOrg()])
  } catch (e) { toast.add({ title: 'Gagal menyimpan anggota', description: galat(e), color: 'error', icon: 'i-lucide-triangle-alert' }) } finally { simpanAnggota.value = false }
}

/* ── AI employee ── */
const karyawanBaru = reactive({ name: '', jobTitle: '', department: 'Umum', specialization: '', sop: '', isSupervisor: false, hermesProfile: '' })
const simpanKaryawan = ref(false)
async function tambahKaryawan() {
  if (!orgTerpilih.value) return
  simpanKaryawan.value = true
  try {
    await $fetch(`/api/orgs/${orgTerpilih.value}/employees`, { method: 'POST', body: { ...karyawanBaru, specialization: karyawanBaru.specialization || undefined, sop: karyawanBaru.sop || undefined, hermesProfile: karyawanBaru.hermesProfile || undefined } })
    toast.add({ title: 'AI employee terdaftar', description: `${karyawanBaru.name} · ${karyawanBaru.jobTitle}`, color: 'success', icon: 'i-lucide-check' })
    karyawanBaru.name = ''; karyawanBaru.jobTitle = ''; karyawanBaru.specialization = ''; karyawanBaru.sop = ''; karyawanBaru.isSupervisor = false; karyawanBaru.hermesProfile = ''
    await Promise.all([segarkanOrg(), segarkanKaryawan()])
  } catch (e) { toast.add({ title: 'Gagal mendaftarkan AI employee', description: galat(e) + ' (admin platform juga harus menjadi owner/manager organisasi ini)', color: 'error', icon: 'i-lucide-triangle-alert' }) } finally { simpanKaryawan.value = false }
}

/* ── pemetaan profil Hermes → AI employee ── */
const { data: karyawan, refresh: segarkanKaryawan } = await useAsyncData<KaryawanAI[]>(() => `admin.karyawan.${orgTerpilih.value ?? 'none'}`, () => orgTerpilih.value && !demo ? ambil<KaryawanAI[]>(`/api/orgs/${orgTerpilih.value}/employees`) : Promise.resolve([]), { watch: [orgTerpilih], default: () => [] })
const profilDraf = reactive<Record<string, string>>({})
watch(karyawan, (d) => { for (const k of d) profilDraf[k.id] = k.hermesProfile ?? '' }, { immediate: true })
const simpanProfilId = ref<string | null>(null)
/** Isi form "AI employee baru" dari profil yang terlihat tapi belum dipetakan (nama = profil, huruf depan kapital). */
function siapkanDariProfil(profil: string) {
  karyawanBaru.hermesProfile = profil
  karyawanBaru.name = profil.replace(/^asisten/, 'Asisten ').replace(/(^|\s)\S/g, c => c.toUpperCase())
  toast.add({ title: `Form diisi untuk profil "${profil}"`, description: 'Lengkapi jabatan & departemen, lalu klik Daftarkan.', color: 'info', icon: 'i-lucide-pencil' })
}
/** Impor massal: satu baris per karyawan "nama; jabatan; departemen; profil Hermes (opsional); supervisor (opsional)". */
const imporTeks = ref('')
const mengimpor = ref(false)
async function imporMassal() {
  if (!orgTerpilih.value) return
  const baris = imporTeks.value.split('\n').map(b => b.trim()).filter(b => b && !b.startsWith('#'))
  if (!baris.length) return
  mengimpor.value = true
  let ok = 0; const gagal: string[] = []
  for (const b of baris) {
    const [name = '', jobTitle = '', department = 'Umum', hermesProfile = '', sup = ''] = b.split(';').map(x => x.trim())
    try {
      await $fetch(`/api/orgs/${orgTerpilih.value}/employees`, { method: 'POST', body: { name, jobTitle, department: department || 'Umum', hermesProfile: hermesProfile || undefined, isSupervisor: /^(ya|y|true|supervisor)$/i.test(sup) } })
      ok++
    } catch (e) { gagal.push(`${name || b}: ${galat(e)}`) }
  }
  toast.add({ title: `${ok} AI employee diimpor${gagal.length ? `, ${gagal.length} gagal` : ''}`, description: gagal.slice(0, 3).join(' · ') || undefined, color: gagal.length ? 'warning' : 'success', icon: gagal.length ? 'i-lucide-triangle-alert' : 'i-lucide-check' })
  if (!gagal.length) imporTeks.value = ''
  mengimpor.value = false
  await Promise.all([segarkanOrg(), segarkanKaryawan()])
}
const ubahAktifId = ref<string | null>(null)
async function ubahAktif(k: KaryawanAI, isActive: boolean) {
  if (!orgTerpilih.value) return
  ubahAktifId.value = k.id
  try {
    await $fetch(`/api/orgs/${orgTerpilih.value}/employees/${k.id}`, { method: 'PATCH', body: { isActive } })
    toast.add({ title: isActive ? `${k.name} diaktifkan` : `${k.name} dinonaktifkan`, description: isActive ? 'Kembali punya meja di kantor.' : 'Tidak lagi punya meja di kantor; data tugasnya tetap tersimpan.', color: 'success', icon: 'i-lucide-check' })
    await Promise.all([segarkanKaryawan(), segarkanOrg()])
  } catch (e) { toast.add({ title: 'Gagal mengubah status', description: galat(e), color: 'error', icon: 'i-lucide-triangle-alert' }) } finally { ubahAktifId.value = null }
}
async function simpanProfil(k: KaryawanAI) {
  if (!orgTerpilih.value) return
  simpanProfilId.value = k.id
  try {
    const nilai = (profilDraf[k.id] ?? '').trim()
    await $fetch(`/api/orgs/${orgTerpilih.value}/employees/${k.id}`, { method: 'PATCH', body: { hermesProfile: nilai || null } })
    toast.add({ title: nilai ? `Profil "${nilai}" → ${k.name}` : `Pemetaan profil ${k.name} dilepas`, description: nilai ? 'Sesi Hermes dari profil ini sekarang tampil sebagai aktivitas employee ini di kantor.' : undefined, color: 'success', icon: 'i-lucide-check' })
    await Promise.all([segarkanKaryawan(), segarkanOrg()])
  } catch (e) { toast.add({ title: 'Gagal menyimpan pemetaan', description: galat(e), color: 'error', icon: 'i-lucide-triangle-alert' }) } finally { simpanProfilId.value = null }
}

/* ── runtime Hermes ── */
const runtimeBaru = reactive({ name: 'utama', baseUrl: '', apiKey: '', outboundSecret: '' })
const simpanRuntime = ref(false)
const hasilRuntime = ref<{ webhookUrl: string, outboundSecret: string, runtime: { id: string } } | null>(null)
async function pasangRuntime() {
  if (!orgTerpilih.value) return
  simpanRuntime.value = true
  try {
    hasilRuntime.value = await $fetch('/api/admin/runtimes', { method: 'POST', body: { organizationId: orgTerpilih.value, name: runtimeBaru.name, baseUrl: runtimeBaru.baseUrl, apiKey: runtimeBaru.apiKey, outboundSecret: runtimeBaru.outboundSecret || undefined } })
    runtimeBaru.apiKey = ''; runtimeBaru.outboundSecret = ''
    toast.add({ title: 'Runtime terpasang', description: 'Salin URL webhook & secret sekarang; tidak akan ditampilkan lagi.', color: 'success', icon: 'i-lucide-check' })
    await segarkanOrg()
  } catch (e) { toast.add({ title: 'Gagal memasang runtime', description: galat(e), color: 'error', icon: 'i-lucide-triangle-alert' }) } finally { simpanRuntime.value = false }
}
/* ubah koneksi tanpa rotasi kunci webhook/secret */
const ubahKoneksi = reactive({ name: '', baseUrl: '', apiKey: '' })
watch(org, (o) => { ubahKoneksi.name = o?.runtime?.name ?? ''; ubahKoneksi.baseUrl = o?.runtime?.baseUrl ?? ''; ubahKoneksi.apiKey = '' }, { immediate: true })
const simpanKoneksi = ref(false)
async function simpanUbahKoneksi() {
  const rt = org.value?.runtime
  if (!rt) return
  simpanKoneksi.value = true
  try {
    await $fetch(`/api/admin/runtimes/${rt.id}`, { method: 'PATCH', body: { name: ubahKoneksi.name || undefined, baseUrl: ubahKoneksi.baseUrl || undefined, apiKey: ubahKoneksi.apiKey || undefined } })
    ubahKoneksi.apiKey = ''
    toast.add({ title: 'Koneksi runtime diperbarui', description: 'Kunci webhook & secret tidak berubah; config Hermes tidak perlu disentuh.', color: 'success', icon: 'i-lucide-check' })
    await probe(rt.id)
  } catch (e) { toast.add({ title: 'Gagal memperbarui koneksi', description: galat(e), color: 'error', icon: 'i-lucide-triangle-alert' }) } finally { simpanKoneksi.value = false }
}
const memprobe = ref(false)
async function probe(id: string) {
  memprobe.value = true
  try {
    const r = await $fetch<{ ok: boolean, error?: string }>(`/api/admin/runtimes/${id}/probe`, { method: 'POST' })
    toast.add({ title: r.ok ? 'Runtime online' : 'Runtime tidak terjangkau', description: r.ok ? 'Kapabilitas dari /v1/capabilities tersimpan.' : r.error, color: r.ok ? 'success' : 'error', icon: r.ok ? 'i-lucide-radio' : 'i-lucide-unplug' })
  } catch (e) { toast.add({ title: 'Runtime tidak terjangkau', description: galat(e), color: 'error', icon: 'i-lucide-unplug' }) } finally { memprobe.value = false; await segarkanOrg() }
}
async function salin(teks: string, label: string) {
  try { await navigator.clipboard.writeText(teks); toast.add({ title: `${label} disalin`, color: 'success', icon: 'i-lucide-clipboard-check' }) } catch { toast.add({ title: 'Tidak bisa menyalin otomatis', description: 'Salin manual dari kotak.', color: 'warning' }) }
}
function blokConfig(url: string) {
  return `hooks:\n  outbound:\n    - name: virtual-office\n      url: ${url}\n      events: [on_session_start, on_session_end, subagent_start, subagent_stop, post_tool_call, pre_approval_request, post_approval_response]\n      secret_env: HERMES_OUTBOUND_WEBHOOK_SECRET\n      timeout: 10`
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">Pengaturan</h1>
      <BadgeDemo v-if="demo" ukuran="sm" />
    </div>

    <UCard v-if="demo">
      <Keadaan jenis="kosong" judul="Mode demo" deskripsi="Pengaturan organisasi, anggota, dan runtime hanya tersedia di mode live." />
    </UCard>
    <UCard v-else-if="!adminPlatform">
      <Keadaan jenis="ditolak" judul="Khusus admin platform" deskripsi="Pengelolaan organisasi, anggota, dan runtime Hermes dilakukan oleh admin platform. Hubungi admin untuk perubahan." />
    </UCard>

    <template v-else>
      <!-- Organisasi -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <h2 class="text-sm font-semibold text-highlighted flex items-center gap-2"><UIcon name="i-lucide-building-2" class="size-4 text-muted" />Organisasi</h2>
            <USelectMenu v-model="orgTerpilih" :items="pilihanOrg" value-key="value" :search-input="false" size="sm" class="w-72" placeholder="Pilih organisasi" :loading="memuatOrg" />
          </div>
        </template>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2">
            <div v-if="org" class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p class="text-xs text-muted">Nama</p><p class="font-medium text-highlighted">{{ org.name }}</p></div>
              <div><p class="text-xs text-muted">Slug</p><p class="font-mono text-[13px] text-highlighted">{{ org.slug }}</p></div>
              <div><p class="text-xs text-muted">Anggota</p><p class="font-medium text-highlighted tnum">{{ org.anggota }}</p></div>
              <div><p class="text-xs text-muted">AI employee</p><p class="font-medium text-highlighted tnum">{{ org.karyawan }}</p></div>
            </div>
            <Keadaan v-else jenis="kosong" padat judul="Belum ada organisasi" deskripsi="Buat organisasi pertama di sebelah kanan." />
          </div>
          <form class="flex flex-col gap-2" @submit.prevent="buatOrg">
            <p class="text-xs font-semibold text-muted uppercase tracking-wider">Organisasi baru</p>
            <UInput v-model="orgBaru.name" placeholder="Nama, mis. PT Contoh" size="sm" required />
            <UInput v-model="orgBaru.slug" placeholder="slug, mis. pt-contoh" size="sm" required pattern="[a-z0-9-]{3,40}" />
            <UButton type="submit" size="sm" icon="i-lucide-plus" label="Buat" :loading="simpanOrg" />
          </form>
        </div>
      </UCard>

      <div v-if="org" class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <!-- Anggota -->
        <UCard>
          <template #header><h2 class="text-sm font-semibold text-highlighted flex items-center gap-2"><UIcon name="i-lucide-users" class="size-4 text-muted" />Anggota · {{ org.name }}</h2></template>
          <ul v-if="anggota.length" class="divide-y divide-default text-sm mb-4">
            <li v-for="a in anggota" :key="a.userId" class="py-2 flex items-center justify-between gap-2">
              <span class="min-w-0"><span class="font-medium text-highlighted">{{ a.name }}</span> <span class="text-muted truncate">· {{ a.email }}</span></span>
              <UBadge variant="soft" color="neutral" size="xs" :label="a.role" />
            </li>
          </ul>
          <p v-else class="text-sm text-muted mb-4">Belum ada anggota.</p>
          <form class="grid grid-cols-1 sm:grid-cols-2 gap-2" @submit.prevent="tambahAnggota">
            <UInput v-model="anggotaBaru.email" type="email" placeholder="email" size="sm" required />
            <UInput v-model="anggotaBaru.name" placeholder="nama" size="sm" required />
            <USelectMenu v-model="anggotaBaru.role" :items="[...PERAN_ORG]" :search-input="false" size="sm" />
            <UInput v-model="anggotaBaru.password" type="password" placeholder="password (hanya bila user baru, ≥10)" size="sm" />
            <UButton type="submit" size="sm" icon="i-lucide-user-plus" label="Simpan anggota" :loading="simpanAnggota" class="sm:col-span-2 w-fit" />
          </form>
        </UCard>

        <!-- AI employee -->
        <UCard>
          <template #header><h2 class="text-sm font-semibold text-highlighted flex items-center gap-2"><UIcon name="i-lucide-bot" class="size-4 text-muted" />AI employee baru · {{ org.name }}</h2></template>
          <form class="grid grid-cols-1 sm:grid-cols-2 gap-2" @submit.prevent="tambahKaryawan">
            <UInput v-model="karyawanBaru.name" placeholder="nama, mis. Rani" size="sm" required />
            <UInput v-model="karyawanBaru.jobTitle" placeholder="jabatan, mis. Spesialis Iklan Meta" size="sm" required />
            <UInput v-model="karyawanBaru.department" placeholder="departemen, mis. Iklan" size="sm" required />
            <UInput v-model="karyawanBaru.specialization" placeholder="spesialisasi (opsional)" size="sm" />
            <UInput v-model="karyawanBaru.hermesProfile" placeholder="profil Hermes, mis. masterceo (opsional)" size="sm" class="sm:col-span-2 font-mono" />
            <UTextarea v-model="karyawanBaru.sop" placeholder="SOP (dikirim sebagai instructions saat tugas diberikan)" :rows="3" size="sm" class="sm:col-span-2" />
            <UCheckbox v-model="karyawanBaru.isSupervisor" label="Supervisor (MasterCEO)" class="sm:col-span-2" />
            <UButton type="submit" size="sm" icon="i-lucide-plus" label="Daftarkan" :loading="simpanKaryawan" class="w-fit" />
          </form>
          <p class="text-xs text-muted mt-3">Endpoint ini memakai peran organisasi; pastikan akun admin juga anggota (owner/manager) organisasi ini.</p>
          <details class="mt-4">
            <summary class="text-xs font-semibold text-muted uppercase tracking-wider cursor-pointer">Impor massal (satu baris per karyawan)</summary>
            <p class="text-xs text-muted mt-2">Format: <code class="font-mono">nama; jabatan; departemen; profil Hermes; supervisor</code> (dua kolom terakhir opsional, supervisor = "ya").</p>
            <UTextarea v-model="imporTeks" :rows="6" size="sm" class="w-full mt-2 font-mono" placeholder="Arga; Koordinator Riset Produk; Riset Produk; arga; ya&#10;Raja; Competitor Intelligence; Riset Produk; raja" />
            <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-upload" label="Impor" :loading="mengimpor" :disabled="!imporTeks.trim()" class="mt-2" @click="imporMassal" />
          </details>
        </UCard>

        <!-- Pemetaan profil Hermes → AI employee -->
        <UCard class="xl:col-span-2">
          <template #header>
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <h2 class="text-sm font-semibold text-highlighted flex items-center gap-2"><UIcon name="i-lucide-link" class="size-4 text-muted" />Profil Hermes → AI employee · {{ org.name }}</h2>
              <p class="text-xs text-muted">Sesi di luar dashboard (Telegram/CLI) tampil di kantor hanya untuk profil yang dipetakan.</p>
            </div>
          </template>
          <div v-if="org.profilBelumDipetakan.length" class="mb-4">
            <p class="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Terlihat mengirim event, belum dipetakan</p>
            <div class="flex flex-wrap gap-1.5">
              <UButton v-for="p in org.profilBelumDipetakan" :key="p.profile" variant="soft" color="warning" size="xs" icon="i-lucide-user-plus" :label="`${p.profile} · ${p.n} event · ${waktuRelatif(p.terakhir)}`" class="font-mono" :title="`Buat AI employee untuk profil ${p.profile}`" @click="siapkanDariProfil(p.profile)" />
            </div>
          </div>
          <ul v-if="karyawan.length" class="divide-y divide-default">
            <li v-for="k in karyawan" :key="k.id" class="py-2 grid grid-cols-1 sm:grid-cols-[1fr_minmax(12rem,16rem)_auto_auto] gap-2 items-center" :class="{ 'opacity-60': !k.isActive }">
              <span class="min-w-0 text-sm"><span class="font-medium text-highlighted">{{ k.name }}</span> <span class="text-muted">· {{ k.jobTitle }} · {{ k.department }}</span><UBadge v-if="!k.isActive" variant="soft" color="neutral" size="xs" label="nonaktif" class="ml-1.5" /><UBadge v-else-if="k.isSupervisor" variant="soft" color="primary" size="xs" label="supervisor" class="ml-1.5" /></span>
              <UInput v-model="profilDraf[k.id]" placeholder="nama profil Hermes" size="sm" class="font-mono" :aria-label="`Profil Hermes untuk ${k.name}`" />
              <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-save" label="Simpan" :loading="simpanProfilId === k.id" :disabled="(profilDraf[k.id] ?? '') === (k.hermesProfile ?? '')" @click="simpanProfil(k)" />
              <UButton size="sm" variant="ghost" color="neutral" :icon="k.isActive ? 'i-lucide-user-x' : 'i-lucide-user-check'" :label="k.isActive ? 'Nonaktifkan' : 'Aktifkan'" :loading="ubahAktifId === k.id" @click="ubahAktif(k, !k.isActive)" />
            </li>
          </ul>
          <p v-else class="text-sm text-muted">Belum ada AI employee di organisasi ini.</p>
        </UCard>

        <!-- Runtime Hermes -->
        <UCard class="xl:col-span-2">
          <template #header>
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <h2 class="text-sm font-semibold text-highlighted flex items-center gap-2"><UIcon name="i-lucide-server" class="size-4 text-muted" />Runtime Hermes · {{ org.name }}</h2>
              <div v-if="org.runtime" class="flex items-center gap-2">
                <BadgeStatus jenis="runtime" :status="(org.runtime.status as any)" ukuran="xs" />
                <UButton size="xs" variant="outline" color="neutral" icon="i-lucide-radar" label="Probe /v1/capabilities" :loading="memprobe" @click="probe(org.runtime!.id)" />
              </div>
            </div>
          </template>

          <div v-if="org.runtime" class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-5">
            <div><p class="text-xs text-muted">Base URL</p><p class="font-mono text-[13px] text-highlighted truncate">{{ org.runtime.baseUrl }}</p></div>
            <div><p class="text-xs text-muted">Versi Hermes</p><p class="font-medium text-highlighted">{{ org.runtime.hermesVersion ?? '—' }}</p></div>
            <div><p class="text-xs text-muted">Terakhir terlihat</p><p class="font-medium text-highlighted">{{ waktuRelatif(org.runtime.lastSeenAt) }}</p></div>
            <div class="min-w-0"><p class="text-xs text-muted">Fitur</p>
              <p v-if="org.runtime.fitur" class="flex flex-wrap gap-1 mt-0.5"><UBadge v-for="(v, k) in org.runtime.fitur" :key="k" :color="v ? 'success' : 'neutral'" variant="soft" size="xs" :label="String(k)" /></p>
              <p v-else class="text-muted">belum diprobe</p>
            </div>
            <p v-if="org.runtime.lastError" class="sm:col-span-4 text-xs text-red-600 dark:text-red-400">{{ org.runtime.lastError }}</p>
          </div>

          <!-- hasil registrasi: tampil sekali -->
          <UAlert v-if="hasilRuntime" color="warning" variant="subtle" icon="i-lucide-key-round" title="Salin sekarang, tidak akan ditampilkan lagi" class="mb-5">
            <template #description>
              <div class="flex flex-col gap-3 mt-2">
                <div>
                  <p class="text-xs font-semibold mb-1">URL webhook (untuk <code class="font-mono">hooks.outbound[].url</code>)</p>
                  <div class="flex gap-2"><UInput :model-value="hasilRuntime.webhookUrl" readonly size="sm" class="flex-1 font-mono" /><UButton size="sm" variant="outline" color="neutral" icon="i-lucide-copy" aria-label="Salin URL" @click="salin(hasilRuntime.webhookUrl, 'URL webhook')" /></div>
                </div>
                <div>
                  <p class="text-xs font-semibold mb-1">Secret HMAC (isi <code class="font-mono">HERMES_OUTBOUND_WEBHOOK_SECRET</code> di <code class="font-mono">$HERMES_HOME/.env</code>)</p>
                  <div class="flex gap-2"><UInput :model-value="hasilRuntime.outboundSecret" readonly size="sm" class="flex-1 font-mono" /><UButton size="sm" variant="outline" color="neutral" icon="i-lucide-copy" aria-label="Salin secret" @click="salin(hasilRuntime.outboundSecret, 'Secret')" /></div>
                </div>
                <div>
                  <p class="text-xs font-semibold mb-1">Blok <code class="font-mono">config.yaml</code> Hermes</p>
                  <div class="flex gap-2 items-start"><pre class="flex-1 text-[11px] font-mono bg-muted rounded-md p-2 overflow-x-auto">{{ blokConfig(hasilRuntime.webhookUrl) }}</pre><UButton size="sm" variant="outline" color="neutral" icon="i-lucide-copy" aria-label="Salin config" @click="salin(blokConfig(hasilRuntime.webhookUrl), 'Blok config')" /></div>
                </div>
                <p class="text-xs">Panduan lengkap: <code class="font-mono">docs/hermes-hook-setup.md</code>. Setelah Hermes di-restart, klik "Probe".</p>
              </div>
            </template>
          </UAlert>

          <form v-if="org.runtime" class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6" @submit.prevent="simpanUbahKoneksi">
            <p class="sm:col-span-2 text-xs font-semibold text-muted uppercase tracking-wider">Ubah koneksi (tanpa rotasi kunci webhook & secret)</p>
            <UInput v-model="ubahKoneksi.name" placeholder="nama runtime" size="sm" />
            <UInput v-model="ubahKoneksi.baseUrl" placeholder="base URL baru, mis. http://100.64.0.5:8642 (tunnel)" size="sm" />
            <UInput v-model="ubahKoneksi.apiKey" type="password" placeholder="API_SERVER_KEY baru (kosongkan = tetap)" size="sm" minlength="16" />
            <div class="flex items-center gap-2"><UButton type="submit" size="sm" variant="outline" color="neutral" icon="i-lucide-link-2" label="Simpan & probe" :loading="simpanKoneksi" /><span class="text-xs text-muted">URL webhook & secret HMAC di Hermes tetap sama.</span></div>
          </form>
          <form class="grid grid-cols-1 sm:grid-cols-2 gap-2" @submit.prevent="pasangRuntime">
            <p class="sm:col-span-2 text-xs font-semibold text-muted uppercase tracking-wider">{{ org.runtime ? 'Pasang ulang runtime (kunci & secret BARU; config Hermes harus diupdate)' : 'Pasang runtime' }}</p>
            <UInput v-model="runtimeBaru.name" placeholder="nama runtime" size="sm" required />
            <UInput v-model="runtimeBaru.baseUrl" placeholder="base URL API server, mis. http://10.0.0.5:8642 (harus terjangkau dari control plane)" size="sm" required />
            <UInput v-model="runtimeBaru.apiKey" type="password" placeholder="API_SERVER_KEY Hermes (≥16 karakter)" size="sm" required minlength="16" />
            <UInput v-model="runtimeBaru.outboundSecret" type="password" placeholder="secret HMAC (kosongkan = dibuat otomatis)" size="sm" />
            <UButton type="submit" size="sm" icon="i-lucide-plug-zap" label="Pasang & tampilkan kunci" :loading="simpanRuntime" class="w-fit" />
          </form>
        </UCard>
      </div>
    </template>
  </div>
</template>
