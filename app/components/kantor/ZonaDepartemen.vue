<script setup lang="ts">
/** Ruangan divisi: lantai, dinding belakang + papan tulis, kaca samping, meja berjajar, rak, tanaman; karakter dengan titik tujuan lokal. */
import type { KaryawanAI } from '~~/shared/kontrak'
import type { AksiKarakter } from '~/utils/koreografi'
import { warnaDept, posisiKaryawan, kurang, TITIK, type Titik } from '~/utils/kantor3d'
import type { Lokasi } from './KarakterAI.vue'

const props = withDefaults(defineProps<{
  nama: string
  karyawan: KaryawanAI[]
  position: Titik
  lebar: number
  dalam: number
  aksiPer: Record<string, AksiKarakter>
  slotMeeting: Record<string, number>
  slotLab: Record<string, number>
  gelap?: boolean
  terpilihId?: string | null
}>(), { gelap: false, terpilihId: null })
const emit = defineEmits<{ pilih: [karyawan: KaryawanAI], lokasi: [id: string, lokasi: Lokasi] }>()

const warna = computed(() => warnaDept(props.nama, props.gelap))
const runBerjalan = computed(() => props.karyawan.reduce((n, k) => n + k.runAktif, 0))
const sibuk = computed(() => props.karyawan.filter(k => (props.aksiPer[k.id]?.mode ?? 'idle') === 'kerja').length)
const lokal = (t: Titik) => kurang(t, props.position)

function titikUntuk(k: KaryawanAI, j: number) {
  const meja = posisiKaryawan(j, props.karyawan.length, props.dalam)
  const sm = props.slotMeeting[k.id] ?? 0
  const sl = props.slotLab[k.id] ?? 0
  return {
    meja,
    hqDepan: lokal(TITIK.hqDepan),
    meeting: lokal(TITIK.meetingKursi[sm % TITIK.meetingKursi.length]!),
    lounge: lokal(TITIK.lounge[j % TITIK.lounge.length]!),
    pantry: lokal(TITIK.pantry[j % TITIK.pantry.length]!),
    lab: TITIK.labMeja.map((_, i) => lokal(TITIK.labMeja[(sl + i) % TITIK.labMeja.length]!))
  }
}
function layarUntuk(k: KaryawanAI): 'mati' | 'aktif' | 'peringatan' {
  const m = props.aksiPer[k.id]?.mode
  if (m === 'membatalkan' || m === 'tidak_diketahui') return 'peringatan'
  return (m === 'kerja' || k.runAktif > 0) && k.isActive ? 'aktif' : 'mati'
}
const aksiBawaan: AksiKarakter = { mode: 'idle', reaksi: null, subagentAktif: 0, tempo: 0, tugasId: null }
const keterangan = computed(() => runBerjalan.value > 0 ? `${runBerjalan.value} run · ${sibuk.value} bekerja` : `${props.karyawan.length} orang · tenang`)
</script>

<template>
  <KantorRuangan :position="position" :lebar="lebar" :dalam="dalam" :nama="`Divisi ${nama}`" :warna-lantai="warna.lantai" :warna-aksen="warna.aksen" :gelap="gelap" kaca :keterangan="keterangan">
    <!-- papan tulis di dinding belakang -->
    <KantorFurnitur :position="[-lebar / 4, 0.95, -dalam / 2 + 0.14]" :ukuran="[Math.min(2.4, lebar * 0.38), 1.0, 0.04]" :warna="gelap ? '#E9ECF0' : '#FFFFFF'" :kasar="0.5" />
    <KantorFurnitur :position="[-lebar / 4, 0.95, -dalam / 2 + 0.14]" :ukuran="[Math.min(2.4, lebar * 0.38) + 0.1, 1.1, 0.02]" :warna="warna.aksen" />
    <!-- rak & tanaman -->
    <KantorFurnitur :position="[lebar / 2 - 0.6, 0.1, -dalam / 2 + 0.4]" :ukuran="[0.9, 1.6, 0.4]" :warna="gelap ? '#3A3020' : '#C58B4E'" />
    <KantorFurnitur v-for="(y, i) in [0.5, 0.95, 1.4]" :key="i" :position="[lebar / 2 - 0.6, y, -dalam / 2 + 0.45]" :ukuran="[0.7, 0.22, 0.3]" :warna="[warna.aksen, '#2E9E6B', '#6F63EA'][i]!" />
    <KantorTanaman :position="[-lebar / 2 + 0.6, 0.1, dalam / 2 - 0.6]" :skala="0.85" />
    <!-- karpet kecil -->
    <KantorFurnitur :position="[0, 0.1, dalam / 2 - 1.0]" :ukuran="[lebar - 2.4, 0.02, 1.1]" :warna="warna.aksen" :transparan="0.18" />

    <template v-for="(k, j) in karyawan" :key="k.id">
      <KantorMejaKerja :position="[posisiKaryawan(j, karyawan.length, dalam)[0], 0.1, posisiKaryawan(j, karyawan.length, dalam)[2] - 0.75]" :layar="layarUntuk(k)" :gelap="gelap" />
      <TresGroup :position="[0, 0.1, 0]">
        <KantorKarakterAI :karyawan="k" :aksi="aksiPer[k.id] ?? aksiBawaan" :titik="titikUntuk(k, j)" :warna="warna.badan" :gelap="gelap" :terpilih="k.id === terpilihId" @pilih="emit('pilih', $event)" @lokasi="(id, l) => emit('lokasi', id, l)" />
      </TresGroup>
    </template>
  </KantorRuangan>
</template>
