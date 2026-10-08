<script setup lang="ts">
import type { BuatPerintah, TugasRingkas } from '~~/shared/kontrak'

useHead({ title: 'Pusat Komando' })

const { demo, orgAktif, bolehAksi, profil, ringkasan, tugas, kirimPerintah } = useOffice()
const { data: profilSaya } = profil()
const { data: ringkas, pending: memuatRingkas, error: galatRingkas, refresh: segarkan } = ringkasan(orgAktif)
const { data: daftarTugas, pending: memuatTugas } = tugas(orgAktif)
const toast = useToast()

const judulTugas = computed<Record<string, string>>(() => Object.fromEntries((daftarTugas.value ?? []).map(t => [t.id, t.title])))

/* Laci detail tugas */
const laciBuka = ref(false)
const tugasDipilih = ref<TugasRingkas | null>(null)
function bukaTugas(id: string) {
  const t = (daftarTugas.value ?? []).find(x => x.id === id) ?? null
  tugasDipilih.value = t
  laciBuka.value = true
}

/* Komposer (hanya live + peran berhak) */
const mengirim = ref(false)
const komposer = ref<{ reset: () => void } | null>(null)
async function kirim(payload: BuatPerintah) {
  if (!orgAktif.value) return
  mengirim.value = true
  try {
    await kirimPerintah(orgAktif.value, payload)
    toast.add({ title: 'Perintah dicatat', description: 'Perintah akan diteruskan ke runtime.', color: 'success', icon: 'i-lucide-check' })
    komposer.value?.reset()
    await segarkan()
  } catch (e) {
    toast.add({ title: 'Gagal mengirim perintah', description: e instanceof Error ? e.message : String(e), color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    mengirim.value = false
  }
}
async function mintaBatal(taskId: string) {
  if (!orgAktif.value) return
  try {
    await kirimPerintah(orgAktif.value, { type: 'REQUEST_CANCEL', taskId })
    toast.add({ title: 'Pembatalan diminta', description: 'Status menjadi "Pembatalan diminta" sampai runtime mengonfirmasi.', color: 'warning', icon: 'i-lucide-hand' })
    laciBuka.value = false
    await segarkan()
  } catch (e) {
    toast.add({ title: 'Gagal meminta pembatalan', description: e instanceof Error ? e.message : String(e), color: 'error', icon: 'i-lucide-triangle-alert' })
  }
}

const tugasAktif = computed(() => (daftarTugas.value ?? []).filter(t => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(t.status)))
const basi = computed(() => (ringkas.value?.runtime.menitSejakEventTerakhir ?? 0) > 10)
</script>

<template>
  <div data-testid="pusat-komando" class="flex flex-col gap-6 lg:gap-8">
    <!-- Judul halaman -->
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-medium uppercase tracking-wider text-muted">{{ ringkas?.org.name ?? 'Organisasi' }}</p>
        <h1 class="text-2xl font-semibold tracking-tight text-highlighted mt-1">Pusat Komando</h1>
      </div>
      <div class="flex items-center gap-3 text-xs text-muted">
        <span v-if="ringkas" :title="waktuLengkap(ringkas.dihitungPada)">Dihitung {{ waktuRelatif(ringkas.dihitungPada) }}</span>
        <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-refresh-cw" label="Segarkan" :loading="memuatRingkas" @click="segarkan()" />
      </div>
    </div>

    <UCard v-if="!orgAktif && !memuatRingkas">
      <Keadaan jenis="kosong" judul="Belum tergabung di organisasi mana pun" deskripsi="Akun Anda belum menjadi anggota organisasi. Minta admin platform menambahkan Anda, atau pilih organisasi di bilah atas bila sudah ada.">
        <template v-if="profilSaya?.user.isPlatformAdmin" #aksi>
          <UButton to="/pengaturan" variant="outline" color="neutral" size="sm" icon="i-lucide-building-2" label="Kelola organisasi" />
        </template>
      </Keadaan>
    </UCard>
    <UAlert
      v-else-if="galatRingkas"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Gagal memuat ringkasan"
      :description="galatRingkas.message"
    />

    <UAlert
      v-else-if="ringkas && basi"
      color="warning"
      variant="subtle"
      icon="i-lucide-clock-alert"
      title="Data basi"
      :description="`Tidak ada event baru selama ${ringkas.runtime.menitSejakEventTerakhir} menit. Angka di bawah mungkin tertinggal dari keadaan runtime.`"
    />

    <!-- Baris KPI -->
    <section aria-label="Ringkasan tugas" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">
      <KartuMetrik label="Tugas berjalan" icon="i-lucide-loader-circle" nada="info" :nilai="ringkas?.tugas.berjalan" :memuat="memuatRingkas" :demo="demo" keterangan="Run non-terminal" />
      <KartuMetrik label="Menunggu persetujuan" icon="i-lucide-shield-question" nada="warning" :nilai="ringkas?.tugas.menungguApproval" :memuat="memuatRingkas" :demo="demo" keterangan="Butuh keputusan" />
      <KartuMetrik label="Selesai 7 hari" icon="i-lucide-circle-check" nada="success" :nilai="ringkas?.tugas.selesai7Hari" :memuat="memuatRingkas" :demo="demo" />
      <KartuMetrik label="Gagal 7 hari" icon="i-lucide-circle-x" nada="error" :nilai="ringkas?.tugas.gagal7Hari" :memuat="memuatRingkas" :demo="demo" />
      <KartuMetrik label="Tidak diketahui" icon="i-lucide-circle-help" nada="warning" :nilai="ringkas?.tugas.tidakDiketahui" :memuat="memuatRingkas" :demo="demo" keterangan="Menunggu rekonsiliasi" />
      <KartuMetrik label="Pendapatan" icon="i-lucide-banknote" belum-tersambung keterangan="Sumber data finansial belum dihubungkan." />
    </section>

    <!-- Dua kolom -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8 items-start">
      <div class="xl:col-span-2 flex flex-col gap-6 lg:gap-8 min-w-0">
        <KomposerPerintah
          v-if="bolehAksi && ringkas"
          ref="komposer"
          :karyawan="ringkas.karyawan"
          :mengirim="mengirim"
          @kirim="kirim"
        />
        <div v-else class="flex items-center gap-2 text-xs text-muted px-1">
          <UIcon name="i-lucide-info" class="size-3.5 shrink-0" aria-hidden="true" />
          <span v-if="demo">Mode demo: aksi dinonaktifkan. Komposer perintah hanya tersedia di mode live.</span>
          <span v-else>Peran Anda tidak dapat mengirim perintah.</span>
        </div>

        <!-- Tugas aktif -->
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-list-checks" class="size-4 text-muted" aria-hidden="true" />
                <h2 class="text-sm font-semibold text-highlighted">Tugas aktif</h2>
                <span class="text-xs text-muted tnum">{{ tugasAktif.length }}</span>
              </div>
              <div class="flex items-center gap-2">
                <BadgeDemo v-if="demo" />
                <UButton to="/tugas" variant="link" color="neutral" size="xs" trailing-icon="i-lucide-arrow-right" label="Papan tugas" />
              </div>
            </div>
          </template>
          <Keadaan v-if="memuatTugas" jenis="memuat" padat />
          <Keadaan v-else-if="!tugasAktif.length" jenis="kosong" judul="Tidak ada tugas aktif" deskripsi="Semua tugas sudah mencapai status terminal." padat />
          <ul v-else class="divide-y divide-default" aria-label="Daftar tugas aktif">
            <li v-for="t in tugasAktif" :key="t.id">
              <button
                type="button"
                class="w-full text-left flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted/60 focus-visible:bg-muted/60 transition-colors"
                :aria-label="`Buka detail tugas: ${t.title}`"
                @click="bukaTugas(t.id)"
              >
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-highlighted truncate">{{ t.title }}</p>
                  <p class="text-xs text-muted mt-0.5 truncate">
                    {{ t.employee?.name ?? 'Belum ditugaskan' }}<span aria-hidden="true"> · </span>dibuat {{ waktuRelatif(t.createdAt) }}
                  </p>
                </div>
                <BadgeStatus :status="t.status" />
                <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed shrink-0" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </UCard>

        <DaftarAktivitas :events="ringkas?.aktivitasTerbaru ?? []" :memuat="memuatRingkas" :demo="demo" :judul-tugas="judulTugas" @pilih="bukaTugas" />
      </div>

      <div class="flex flex-col gap-6 lg:gap-8 min-w-0">
        <!-- Persetujuan -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-shield-check" class="size-4 text-muted" aria-hidden="true" />
                <h2 class="text-sm font-semibold text-highlighted">Persetujuan tertunda</h2>
              </div>
              <BadgeDemo v-if="demo" />
            </div>
          </template>
          <div class="flex items-end justify-between gap-4">
            <div>
              <USkeleton v-if="memuatRingkas" class="h-9 w-12" />
              <p v-else class="text-3xl font-semibold tracking-tight text-highlighted tnum leading-none">{{ ringkas ? angkaId(ringkas.approvalTertunda) : '—' }}</p>
              <p class="text-xs text-muted mt-2">Permintaan dari runtime yang menunggu keputusan manusia.</p>
            </div>
            <UButton to="/persetujuan" variant="outline" color="neutral" size="sm" trailing-icon="i-lucide-arrow-right" label="Tinjau" />
          </div>
        </UCard>

        <KartuRuntime :runtime="ringkas?.runtime ?? null" :memuat="memuatRingkas" :demo="demo" />

        <!-- Roster -->
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-users" class="size-4 text-muted" aria-hidden="true" />
                <h2 class="text-sm font-semibold text-highlighted">AI employee</h2>
                <span class="text-xs text-muted tnum">{{ ringkas?.karyawan.length ?? 0 }}</span>
              </div>
              <BadgeDemo v-if="demo" />
            </div>
          </template>
          <Keadaan v-if="memuatRingkas" jenis="memuat" padat />
          <Keadaan v-else-if="!ringkas?.karyawan.length" jenis="kosong" judul="Belum ada AI employee" deskripsi="Tambahkan karyawan AI di Kantor Virtual." padat />
          <ul v-else class="divide-y divide-default" aria-label="Roster AI employee">
            <li v-for="k in ringkas.karyawan" :key="k.id">
              <KartuKaryawan :karyawan="k" @pilih-tugas="bukaTugas" />
            </li>
          </ul>
        </UCard>
      </div>
    </div>

    <LaciTugas v-model:open="laciBuka" :tugas="tugasDipilih" :events="ringkas?.aktivitasTerbaru ?? []" :demo="demo" :boleh-aksi="bolehAksi" @batalkan="mintaBatal" />
  </div>
</template>
