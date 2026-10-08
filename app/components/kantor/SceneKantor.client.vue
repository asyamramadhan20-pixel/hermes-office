<script setup lang="ts">
/**
 * Kanvas 3D kantor (client-only). Denah: Meeting · HQ · Lab (belakang), pod departemen (tengah), Lounge · Pantry (depan).
 * Setiap gerak karakter diturunkan dari data (tugas + event) oleh `turunkanAksi`; tidak ada aktivitas simulasi.
 */
import { OrbitControls } from '@tresjs/cientos'
import { NoToneMapping, SRGBColorSpace } from 'three'
import type { KaryawanAI, TugasRingkas, EventRingkas } from '~~/shared/kontrak'
import { shallowRef } from 'vue'
import type { OrbitControls as OrbitControlsTipe } from 'three-stdlib'
import { posisiZona, ukuranRuangDivisi, LANTAI, RUANG, type Titik } from '~/utils/kantor3d'
import { turunkanAksi, turunkanAksiSupervisor, type AksiKarakter } from '~/utils/koreografi'
import type { Lokasi } from './KarakterAI.vue'

const props = withDefaults(defineProps<{
  karyawan: KaryawanAI[]
  tugas: TugasRingkas[]
  events: EventRingkas[]
  namaOrg: string
  terpilihId?: string | null
  /** Fokus kamera: posisi ruangan + jarak; null = tampilan seluruh kantor. */
  fokus?: { id: string, posisi: Titik, jarak: number } | null
}>(), { terpilihId: null, fokus: null })
const emit = defineEmits<{ pilih: [karyawan: KaryawanAI], ringkasLokasi: [r: Record<Lokasi, number>], daftarRuang: [r: { id: string, nama: string, posisi: Titik, jarak: number }[]] }>()

const colorMode = useColorMode()
const gelap = computed(() => colorMode.value === 'dark')
const latar = computed(() => gelap.value ? '#101319' : '#F4F6F8')

const sempit = ref(typeof window !== 'undefined' && window.innerWidth < 768)
const posisiKamera = computed<[number, number, number]>(() => sempit.value ? [0, 26, 33] : [0, 21, 26])
const fov = computed(() => sempit.value ? 56 : 40)

/* ── fokus kamera: dijalankan oleh KantorFokusKamera di dalam kanvas ── */
// Template ref ke komponen OrbitControls: `instance` (ShallowRef) sudah di-unwrap oleh proxy komponen,
// tetapi dijaga untuk kedua bentuk supaya tidak bergantung pada detail implementasi cientos.
const kontrol = shallowRef<{ instance: OrbitControlsTipe | { value: OrbitControlsTipe | null } | null } | null>(null)
const instansKontrol = computed<OrbitControlsTipe | null>(() => {
  const i = kontrol.value?.instance
  if (!i) return null
  return 'update' in i ? i : (i.value ?? null)
})

/* jam berjalan supaya mode berbasis waktu (reaksi ≤90 dtk, rayakan ≤3 mnt) ikut bergeser */
const sekarang = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(() => { sekarang.value = Date.now() }, 1000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

const supervisor = computed(() => props.karyawan.find(k => k.isSupervisor) ?? null)
const departemen = computed(() => {
  const peta = new Map<string, KaryawanAI[]>()
  for (const k of props.karyawan.filter(k => !k.isSupervisor)) peta.set(k.department, [...(peta.get(k.department) ?? []), k])
  const daftar = [...peta.entries()].sort((a, b) => a[0].localeCompare(b[0], 'id')).map(([nama, daftar]) => ({ nama, daftar }))
  const ukuran = daftar.map(d => ukuranRuangDivisi(d.daftar.length, daftar.length))
  return daftar.map((d, i) => ({ ...d, ...ukuran[i]!, position: posisiZona(i, daftar.length, ukuran.map(u => u.lebar)) }))
})
/* daftar ruangan untuk chip fokus di halaman */
watch(departemen, (d) => {
  emit('daftarRuang', [
    { id: 'hq', nama: 'HQ', posisi: RUANG.hq, jarak: 9 },
    { id: 'meeting', nama: 'Ruang Meeting', posisi: RUANG.meeting, jarak: 9 },
    { id: 'lab', nama: 'Lab Subagent', posisi: RUANG.lab, jarak: 9 },
    ...d.map(x => ({ id: `divisi:${x.nama}`, nama: `Divisi ${x.nama}`, posisi: x.position, jarak: Math.max(8, x.lebar * 1.3) })),
    { id: 'santai', nama: 'Ruang Santai', posisi: RUANG.lounge, jarak: 9 },
    { id: 'pantry', nama: 'Pantry', posisi: RUANG.pantry, jarak: 9 }
  ])
}, { immediate: true })

const aksiPer = computed<Record<string, AksiKarakter>>(() => {
  const hasil: Record<string, AksiKarakter> = {}
  for (const k of props.karyawan) hasil[k.id] = k.isSupervisor ? turunkanAksiSupervisor(k, props.tugas, props.events, sekarang.value) : turunkanAksi(k, props.tugas, props.events, sekarang.value)
  return hasil
})
/* slot kursi meeting & meja lab dibagi berurutan supaya tidak bertumpuk */
const slotMeeting = computed(() => { const s: Record<string, number> = {}; let i = 0; for (const k of props.karyawan) if (aksiPer.value[k.id]?.mode === 'menunggu_persetujuan') s[k.id] = i++; return s })
const slotLab = computed(() => { const s: Record<string, number> = {}; let i = 0; for (const k of props.karyawan) { s[k.id] = i; i += aksiPer.value[k.id]?.subagentAktif ?? 0 }; return s })
const jumlahMenunggu = computed(() => Object.keys(slotMeeting.value).length)
const jumlahSubagent = computed(() => Object.values(aksiPer.value).reduce((n, a) => n + a.subagentAktif, 0))

/* lokasi nyata tiap karakter (dilaporkan mesin gerak) → hitungan ruangan */
const lokasiPer = reactive<Record<string, Lokasi>>({})
function catatLokasi(id: string, l: Lokasi) {
  lokasiPer[id] = l
  const r: Record<Lokasi, number> = { meja: 0, meeting: 0, lounge: 0, pantry: 0, hqDepan: 0, jalan: 0 }
  for (const v of Object.values(lokasiPer)) r[v]++
  emit('ringkasLokasi', r)
}
const diLounge = computed(() => Object.values(lokasiPer).filter(l => l === 'lounge').length)
const diPantry = computed(() => Object.values(lokasiPer).filter(l => l === 'pantry').length)

const aksiSupervisor = computed<AksiKarakter>(() => supervisor.value ? aksiPer.value[supervisor.value.id]! : { mode: 'idle', reaksi: null, subagentAktif: 0, tempo: 0, tugasId: null })
</script>

<template>
  <TresCanvas :clear-color="latar" shadows :tone-mapping="NoToneMapping" :output-color-space="SRGBColorSpace" :dpr="[1, 1.5]">
    <TresPerspectiveCamera :position="posisiKamera" :fov="fov" :look-at="[0, 0.3, 0.8]" />
    <OrbitControls ref="kontrol" :enable-pan="true" :min-distance="14" :max-distance="48" :min-polar-angle="0.45" :max-polar-angle="1.3" :target="[0, 0.3, 0.8]" />

    <KantorFokusKamera :kontrol="instansKontrol" :fokus="fokus ?? null" :kamera-awal="posisiKamera" :arah-awal="[0, 0.3, 0.8]" />

    <TresAmbientLight :intensity="gelap ? 0.55 : 0.85" />
    <TresDirectionalLight :position="[8, 18, 10]" :intensity="gelap ? 1.5 : 2.1" cast-shadow :shadow-mapSize-width="2048" :shadow-mapSize-height="2048"
      :shadow-camera-left="-22" :shadow-camera-right="22" :shadow-camera-top="22" :shadow-camera-bottom="-22" :shadow-camera-far="60" />
    <TresHemisphereLight :args="[gelap ? '#3A4A7A' : '#DCE8FF', gelap ? '#101319' : '#C9CFD8', 0.5]" />

    <!-- lantai kantor + tepi -->
    <TresMesh :position="[0, -0.2, 0]" receive-shadow>
      <TresBoxGeometry :args="[LANTAI.lebar, 0.4, LANTAI.dalam]" />
      <TresMeshStandardMaterial :color="gelap ? '#1E2330' : '#FFFFFF'" :roughness="0.95" />
    </TresMesh>
    <TresMesh :position="[0, -0.42, 0]">
      <TresBoxGeometry :args="[LANTAI.lebar + 0.6, 0.08, LANTAI.dalam + 0.6]" />
      <TresMeshStandardMaterial :color="gelap ? '#2A2F3A' : '#D5DAE1'" />
    </TresMesh>
    <!-- koridor: jalur abu muda dari HQ ke depan & melintang -->
    <TresMesh :position="[0, 0.005, -3.3]" receive-shadow>
      <TresBoxGeometry :args="[LANTAI.lebar - 2, 0.01, 1.6]" />
      <TresMeshStandardMaterial :color="gelap ? '#232935' : '#EEF1F5'" :roughness="1" />
    </TresMesh>
    <TresMesh :position="[0, 0.005, 3.9]" receive-shadow>
      <TresBoxGeometry :args="[LANTAI.lebar - 2, 0.01, 1.6]" />
      <TresMeshStandardMaterial :color="gelap ? '#232935' : '#EEF1F5'" :roughness="1" />
    </TresMesh>
    <TresMesh v-for="x in [-16, 16]" :key="x" :position="[x, 0.005, 0]" receive-shadow>
      <TresBoxGeometry :args="[1.2, 0.01, LANTAI.dalam - 2]" />
      <TresMeshStandardMaterial :color="gelap ? '#232935' : '#EEF1F5'" :roughness="1" />
    </TresMesh>

    <KantorRuangMeeting :position="RUANG.meeting" :gelap="gelap" :jumlah-menunggu="jumlahMenunggu" />
    <KantorGedungPusat :position="RUANG.hq" :supervisor="supervisor" :aksi="aksiSupervisor" :nama-org="namaOrg" :gelap="gelap" :terpilih-id="terpilihId" @pilih="emit('pilih', $event)" @lokasi="catatLokasi" />
    <KantorRuangLab :position="RUANG.lab" :gelap="gelap" :jumlah-subagent="jumlahSubagent" />
    <KantorRuangLounge :position="RUANG.lounge" :gelap="gelap" :jumlah-santai="diLounge" />
    <KantorRuangPantry :position="RUANG.pantry" :gelap="gelap" :jumlah-ngopi="diPantry" />

    <KantorZonaDepartemen
      v-for="d in departemen" :key="d.nama"
      :nama="d.nama" :karyawan="d.daftar" :position="d.position" :lebar="d.lebar" :dalam="d.dalam" :aksi-per="aksiPer" :slot-meeting="slotMeeting" :slot-lab="slotLab"
      :gelap="gelap" :terpilih-id="terpilihId"
      @pilih="emit('pilih', $event)" @lokasi="catatLokasi"
    />
  </TresCanvas>
</template>
