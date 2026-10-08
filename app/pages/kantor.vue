<script setup lang="ts">
/**
 * Kantor Virtual 3D (keputusan Asyam 8 Okt 2026, menggantikan PRD §10 "2D dulu").
 * Invarian tetap: setiap karakter yang bergerak/menyala = run nyata di agent_runs; tidak ada aktivitas simulasi.
 */
import type { KaryawanAI, TugasRingkas, EventRingkas } from '~~/shared/kontrak'

useHead({ title: 'Kantor Virtual' })

const { demo, orgAktif, bolehAksi, profil, ringkasan, tugas, kirimPerintah } = useOffice()
const { data: profilSaya } = profil()
const { data: ringkas, pending: memuat, error: galat, refresh: segarkan } = ringkasan(orgAktif)
const { data: daftarTugas } = tugas(orgAktif)
const toast = useToast()

const karyawan = computed(() => ringkas.value?.karyawan ?? [])
const ringkasKantor = computed(() => ({
  karyawan: karyawan.value.filter(k => k.isActive).length,
  sibuk: karyawan.value.filter(k => k.runAktif > 0).length,
  run: karyawan.value.reduce((n, k) => n + k.runAktif, 0),
  departemen: new Set(karyawan.value.filter(k => !k.isSupervisor).map(k => k.department)).size
}))
const basi = computed(() => (ringkas.value?.runtime.menitSejakEventTerakhir ?? 0) > 10)

/**
 * Sumber event untuk koreografi.
 * - live: aktivitasTerbaru dari control plane, disegarkan tiap 15 dtk (SSE menyusul).
 * - demo: fixture diputar ulang tiap 6 dtk dengan stempel waktu sekarang supaya reaksi terlihat; SELALU berlabel DEMO.
 */
const eventKoreografi = ref<EventRingkas[]>([])
let timerEvent: ReturnType<typeof setInterval> | null = null
let indeksReplay = 0
watch(() => ringkas.value?.aktivitasTerbaru, (ev) => { if (!demo && ev) eventKoreografi.value = ev }, { immediate: true })
onMounted(() => {
  if (demo) {
    const sumber = ringkas.value?.aktivitasTerbaru ?? []
    eventKoreografi.value = [...sumber]
    timerEvent = setInterval(() => {
      if (!sumber.length) return
      const asli = sumber[indeksReplay % sumber.length]!
      indeksReplay++
      eventKoreografi.value = [{ ...asli, id: `${asli.id}-replay-${indeksReplay}`, occurredAt: new Date().toISOString() }, ...eventKoreografi.value].slice(0, 40)
    }, 6000)
  } else {
    timerEvent = setInterval(() => { segarkan() }, 15000)
  }
})
onBeforeUnmount(() => { if (timerEvent) clearInterval(timerEvent) })

const ringkasLokasi = ref<Record<string, number>>({})
const terputus = computed(() => ringkas.value?.runtime.status === 'offline')

/* Laci profil & laci tugas */
const laciKaryawan = ref(false)
const karyawanDipilih = ref<KaryawanAI | null>(null)
function pilihKaryawan(k: KaryawanAI) { karyawanDipilih.value = k; laciKaryawan.value = true }

const laciTugas = ref(false)
const tugasDipilih = ref<TugasRingkas | null>(null)
function bukaTugas(id: string) {
  tugasDipilih.value = (daftarTugas.value ?? []).find(t => t.id === id) ?? null
  laciTugas.value = true
}
async function mintaBatal(taskId: string) {
  if (!orgAktif.value) return
  try {
    await kirimPerintah(orgAktif.value, { type: 'REQUEST_CANCEL', taskId })
    toast.add({ title: 'Pembatalan diminta', description: 'Status menjadi "Pembatalan diminta" sampai runtime mengonfirmasi.', color: 'warning', icon: 'i-lucide-hand' })
    laciTugas.value = false
    await segarkan()
  } catch (e) {
    toast.add({ title: 'Gagal meminta pembatalan', description: e instanceof Error ? e.message : String(e), color: 'error', icon: 'i-lucide-triangle-alert' })
  }
}
</script>

<template>
  <div data-testid="kantor-virtual" class="flex flex-col gap-5 lg:gap-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-medium uppercase tracking-wider text-muted">{{ ringkas?.org.name ?? 'Organisasi' }}</p>
        <h1 class="text-2xl font-semibold tracking-tight text-highlighted mt-1">Kantor Virtual</h1>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <BadgeStatus v-if="ringkas" jenis="runtime" :status="ringkas.runtime.status" />
        <BadgeDemo v-if="demo" ukuran="sm" />
        <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-refresh-cw" label="Segarkan" :loading="memuat" @click="segarkan()" />
      </div>
    </div>

    <UAlert v-if="galat" color="error" variant="subtle" icon="i-lucide-triangle-alert" title="Gagal memuat kantor" :description="galat.message" />
    <UAlert v-else-if="terputus" color="error" variant="subtle" icon="i-lucide-unplug" title="Runtime terputus" :description="`Yang tampil adalah keadaan terakhir yang diketahui. ${ringkas?.runtime.lastError ?? ''}`" />
    <UAlert v-else-if="ringkas && basi" color="warning" variant="subtle" icon="i-lucide-clock-alert" title="Data basi" :description="`Tidak ada event baru selama ${ringkas.runtime.menitSejakEventTerakhir} menit.`" />

    <!-- Kanvas 3D -->
    <UCard v-if="!orgAktif && !memuat">
      <Keadaan jenis="kosong" judul="Belum tergabung di organisasi mana pun" deskripsi="Akun Anda belum menjadi anggota organisasi. Minta admin platform menambahkan Anda, atau pilih organisasi di bilah atas bila sudah ada.">
        <template v-if="profilSaya?.user.isPlatformAdmin" #aksi>
          <UButton to="/pengaturan" variant="outline" color="neutral" size="sm" icon="i-lucide-building-2" label="Kelola organisasi" />
        </template>
      </Keadaan>
    </UCard>
    <UCard v-else-if="memuat && !ringkas"><Keadaan jenis="memuat" /></UCard>
    <UCard v-else-if="ringkas && karyawan.length === 0">
      <Keadaan jenis="kosong" judul="Kantor masih kosong" deskripsi="Daftarkan AI employee permanen (peran, SOP, departemen) supaya kantor ini terisi.">
        <template v-if="bolehAksi" #aksi>
          <UButton to="/pengaturan" variant="outline" color="neutral" size="sm" icon="i-lucide-user-plus" label="Ke Pengaturan" />
        </template>
      </Keadaan>
    </UCard>
    <div v-else-if="ringkas" class="relative rounded-xl ring-1 ring-default overflow-hidden bg-shell" :style="{ height: 'clamp(480px, 72vh, 860px)' }">
      <ClientOnly>
        <KantorSceneKantor :karyawan="karyawan" :tugas="daftarTugas ?? []" :events="eventKoreografi" :nama-org="ringkas.org.name" :terpilih-id="karyawanDipilih?.id" @pilih="pilihKaryawan" @ringkas-lokasi="ringkasLokasi = $event" />
        <template #fallback><Keadaan jenis="memuat" judul="Menyiapkan kantor 3D…" deskripsi="Membutuhkan WebGL di peramban." /></template>
      </ClientOnly>

      <!-- Overlay ringkasan (HTML, bukan bagian scene) -->
      <div class="absolute top-3 left-3 right-3 flex flex-wrap gap-1.5 pointer-events-none">
        <span class="text-xs px-2 py-1 rounded-md bg-default/90 ring-1 ring-default backdrop-blur-sm text-highlighted tnum"><UIcon name="i-lucide-users" class="size-3 mr-1 align-[-2px]" aria-hidden="true" />{{ ringkasKantor.karyawan }} AI employee</span>
        <span class="text-xs px-2 py-1 rounded-md bg-default/90 ring-1 ring-cyan-500/40 backdrop-blur-sm text-cyan-700 dark:text-cyan-300 tnum"><UIcon name="i-lucide-activity" class="size-3 mr-1 align-[-2px]" aria-hidden="true" />{{ ringkasKantor.run }} run berjalan · {{ ringkasKantor.sibuk }} sedang bekerja</span>
        <span class="text-xs px-2 py-1 rounded-md bg-default/90 ring-1 ring-default backdrop-blur-sm text-highlighted tnum"><UIcon name="i-lucide-building-2" class="size-3 mr-1 align-[-2px]" aria-hidden="true" />{{ ringkasKantor.departemen }} departemen</span>
        <span v-if="ringkasLokasi.meeting" class="text-xs px-2 py-1 rounded-md bg-default/90 ring-1 ring-amber-500/40 backdrop-blur-sm text-amber-700 dark:text-amber-300 tnum"><UIcon name="i-lucide-shield-question" class="size-3 mr-1 align-[-2px]" aria-hidden="true" />{{ ringkasLokasi.meeting }} di ruang meeting</span>
        <span v-if="(ringkasLokasi.lounge ?? 0) + (ringkasLokasi.pantry ?? 0)" class="text-xs px-2 py-1 rounded-md bg-default/90 ring-1 ring-default backdrop-blur-sm text-muted tnum"><UIcon name="i-lucide-coffee" class="size-3 mr-1 align-[-2px]" aria-hidden="true" />{{ (ringkasLokasi.lounge ?? 0) + (ringkasLokasi.pantry ?? 0) }} istirahat</span>
      </div>
      <p class="absolute bottom-3 left-3 right-3 text-[11px] text-muted bg-default/80 backdrop-blur-sm rounded-md px-2 py-1 ring-1 ring-default w-fit max-w-full pointer-events-none">
        Seret untuk memutar, gulir untuk zoom, klik karakter untuk profil. Gerak tiap orang diturunkan dari status tugas & event nyata (menerima tugas → jalan dari HQ, menunggu persetujuan → ruang meeting, subagent → lab, idle → santai/pantry).<span v-if="demo"> Mode demo memutar ulang event fixture.</span>
      </p>
    </div>

    <!-- Daftar aksesibel (pembaca layar / tanpa WebGL) -->
    <ul v-if="ringkas && karyawan.length" class="sr-only" aria-label="Daftar AI employee">
      <li v-for="k in karyawan" :key="k.id">
        <button type="button" @click="pilihKaryawan(k)">{{ k.name }}, {{ k.jobTitle }}, {{ k.department }}, {{ k.runAktif > 0 ? `${k.runAktif} run berjalan` : 'idle' }}</button>
      </li>
    </ul>

    <LaciKaryawan v-model:open="laciKaryawan" :karyawan="karyawanDipilih" :tugas="daftarTugas ?? []" :demo="demo" @buka-tugas="bukaTugas" />
    <LaciTugas v-model:open="laciTugas" :tugas="tugasDipilih" :events="ringkas?.aktivitasTerbaru ?? []" :demo="demo" :boleh-aksi="bolehAksi" @batalkan="mintaBatal" />
  </div>
</template>
