<script setup lang="ts">
/**
 * Karakter satu AI employee + mesin gerak. Semua gerak berasal dari `aksi` (turunan status tugas & event nyata):
 *   berangkat → jalan dari HQ ke meja · kerja → mengetik di meja (tempo = jumlah event nyata) ·
 *   menunggu_persetujuan → duduk di ruang meeting · membatalkan / tidak_diketahui → di meja, layar amber ·
 *   rayakan → lompat · gagal → tertunduk · idle → sesekali jalan ke lounge/pantry (label tetap "idle") ·
 *   delegasi (supervisor) → ke depan HQ lalu kembali. Reaksi = event baru ≤90 dtk → gerakan kecil + chip label.
 * Koordinat `titik.*` dalam ruang lokal induk.
 */
import { shallowRef } from 'vue'
import type { Group, Mesh } from 'three'
import { useLoop } from '@tresjs/core'
import { Html } from '@tresjs/cientos'
import type { KaryawanAI } from '~~/shared/kontrak'
import type { AksiKarakter } from '~/utils/koreografi'
import { LABEL_MODE } from '~/utils/koreografi'
import { WARNA_AKTIF, type Titik } from '~/utils/kantor3d'

export type Lokasi = 'meja' | 'meeting' | 'lounge' | 'pantry' | 'hqDepan' | 'jalan'

const props = withDefaults(defineProps<{
  karyawan: KaryawanAI
  aksi: AksiKarakter
  warna: string
  titik: { meja: Titik, hqDepan: Titik, meeting: Titik, lounge: Titik, pantry: Titik, lab: Titik[] }
  gelap?: boolean
  terpilih?: boolean
}>(), { gelap: false, terpilih: false })
const emit = defineEmits<{ pilih: [karyawan: KaryawanAI], lokasi: [id: string, lokasi: Lokasi] }>()

const grup = shallowRef<Group | null>(null)
const kakiKiri = shallowRef<Mesh | null>(null), kakiKanan = shallowRef<Mesh | null>(null)
const lenganKiri = shallowRef<Mesh | null>(null), lenganKanan = shallowRef<Mesh | null>(null)
const kepala = shallowRef<Mesh | null>(null)
const hover = ref(false)

const aktif = computed(() => props.karyawan.isActive)
const warnaBadan = computed(() => aktif.value ? props.warna : (props.gelap ? '#4C5567' : '#B4BBC7'))
const warnaKulit = computed(() => aktif.value ? '#F2C9A8' : (props.gelap ? '#6B7384' : '#D5DAE1'))
const bekerja = computed(() => ['kerja', 'membatalkan', 'tidak_diketahui'].includes(props.aksi.mode))

/* ── state gerak (di luar reaktivitas Vue, diubah per frame) ── */
const pos = { x: props.titik.meja[0], z: props.titik.meja[2] }
let tujuan: Titik = props.titik.meja
let lokasi: Lokasi = 'meja'
let berjalan = false
let wanderBerikutnya = 8 + Math.random() * 12
let pulangPada = 0
let tujuanWander: 'lounge' | 'pantry' | null = null
let delegasiPulang = 0
let lompatSampai = 0
let rayakanSampai = 0
const fase = Math.random() * Math.PI * 2

// mode berangkat pertama kali: mulai dari depan HQ
if (props.aksi.mode === 'berangkat') { pos.x = props.titik.hqDepan[0]; pos.z = props.titik.hqDepan[2] }

/* chip reaksi: tampil 5 detik setiap ada event baru */
const chip = ref<string | null>(null)
let chipTimer: ReturnType<typeof setTimeout> | null = null
watch(() => props.aksi.reaksi?.id, (id) => {
  if (!id || !props.aksi.reaksi) return
  chip.value = props.aksi.reaksi.label
  lompatSampai = -1 // ditandai; diisi waktu nyata di frame berikutnya
  if (chipTimer) clearTimeout(chipTimer)
  chipTimer = setTimeout(() => { chip.value = null }, 5000)
}, { immediate: true })
watch(() => props.aksi.mode, (m, lama) => {
  if (m === 'rayakan' && lama !== 'rayakan') rayakanSampai = -1
  if (m === 'berangkat' && lama !== 'berangkat') { pos.x = props.titik.hqDepan[0]; pos.z = props.titik.hqDepan[2] }
  if (m === 'delegasi' && lama !== 'delegasi') delegasiPulang = -1
  tujuanWander = null
})
onBeforeUnmount(() => { if (chipTimer) clearTimeout(chipTimer); document.body.style.cursor = '' })

function setLokasi(l: Lokasi) { if (l !== lokasi) { lokasi = l; emit('lokasi', props.karyawan.id, l) } }

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta, elapsed }) => {
  const g = grup.value
  if (!g) return
  const t = props.titik
  const mode = props.aksi.mode

  /* 1. tentukan tujuan dari mode */
  if (mode === 'menunggu_persetujuan') tujuan = t.meeting
  else if (mode === 'delegasi') {
    if (delegasiPulang < 0) delegasiPulang = elapsed + 4
    tujuan = elapsed < delegasiPulang ? t.hqDepan : t.meja
  } else if (mode === 'idle' && aktif.value) {
    if (!tujuanWander && elapsed > wanderBerikutnya) { tujuanWander = Math.random() < 0.5 ? 'lounge' : 'pantry'; pulangPada = 0 }
    if (tujuanWander) {
      tujuan = tujuanWander === 'lounge' ? t.lounge : t.pantry
      const sampai = Math.hypot(tujuan[0] - pos.x, tujuan[2] - pos.z) < 0.08
      if (sampai && !pulangPada) pulangPada = elapsed + 5 + Math.random() * 5
      if (pulangPada && elapsed > pulangPada) { tujuanWander = null; wanderBerikutnya = elapsed + 12 + Math.random() * 18; tujuan = t.meja }
    } else tujuan = t.meja
  } else tujuan = t.meja

  /* 2. gerak menuju tujuan */
  const dx = tujuan[0] - pos.x, dz = tujuan[2] - pos.z
  const jarak = Math.hypot(dx, dz)
  const laju = Math.min(3.2, 1.7 + props.aksi.tempo * 0.12)
  if (jarak > 0.04) {
    const langkah = Math.min(jarak, laju * delta)
    pos.x += dx / jarak * langkah; pos.z += dz / jarak * langkah
    g.rotation.y = Math.atan2(dx, dz)
    berjalan = true
    setLokasi('jalan')
  } else {
    berjalan = false
    if (tujuan === t.meja) { g.rotation.y = Math.PI; setLokasi('meja') }
    else if (tujuan === t.meeting) { g.rotation.y = 0; setLokasi('meeting') }
    else if (tujuan === t.lounge) { g.rotation.y = Math.PI / 2; setLokasi('lounge') }
    else if (tujuan === t.pantry) { g.rotation.y = -Math.PI / 2; setLokasi('pantry') }
    else if (tujuan === t.hqDepan) { g.rotation.y = 0; setLokasi('hqDepan') }
  }
  g.position.x = pos.x; g.position.z = pos.z

  /* 3. animasi anggota badan */
  const kk = kakiKiri.value, kn = kakiKanan.value, lk = lenganKiri.value, ln = lenganKanan.value, kp = kepala.value
  let y = 0
  if (berjalan) {
    const s = Math.sin(elapsed * 11)
    if (kk) kk.rotation.x = s * 0.55; if (kn) kn.rotation.x = -s * 0.55
    if (lk) lk.rotation.x = -s * 0.45; if (ln) ln.rotation.x = s * 0.45
    y = Math.abs(Math.sin(elapsed * 11)) * 0.04
  } else {
    if (kk) kk.rotation.x = 0; if (kn) kn.rotation.x = 0
    if (bekerja.value && !berjalan) {
      // mengetik: lengan ke depan, getar sesuai tempo event nyata
      const ketik = 10 + Math.min(props.aksi.tempo, 12)
      if (lk) lk.rotation.x = -1.1 + Math.sin(elapsed * ketik + fase) * 0.12
      if (ln) ln.rotation.x = -1.1 + Math.cos(elapsed * ketik + fase) * 0.12
      y = Math.sin(elapsed * 2.2 + fase) * 0.015
    } else if (mode === 'tidak_diketahui') {
      if (lk) lk.rotation.x = 0; if (ln) ln.rotation.x = -2.6 // tangan ke kepala: bingung
    } else if (mode === 'menunggu_persetujuan') {
      if (lk) lk.rotation.x = -0.9; if (ln) ln.rotation.x = -0.9 // tangan terlipat di meja meeting
    } else {
      if (lk) lk.rotation.x = 0; if (ln) ln.rotation.x = 0
    }
  }
  if (kp) kp.rotation.x = mode === 'gagal' ? 0.5 : mode === 'tidak_diketahui' ? -0.15 : 0
  /* 4. lompat: reaksi event baru & rayakan */
  if (lompatSampai < 0) lompatSampai = elapsed + 0.6
  if (rayakanSampai < 0) rayakanSampai = elapsed + 2.0
  if (elapsed < lompatSampai) y += Math.sin((1 - (lompatSampai - elapsed) / 0.6) * Math.PI) * 0.28
  if (elapsed < rayakanSampai) y += Math.abs(Math.sin(elapsed * 9)) * 0.22
  // "duduk" di kursi meeting: badan turun sedikit
  if (!berjalan && tujuan === t.meeting) y -= 0.26
  g.position.y = y
})

function pilih() { emit('pilih', props.karyawan) }
function masuk() { hover.value = true; document.body.style.cursor = 'pointer' }
function keluar() { hover.value = false; document.body.style.cursor = '' }

const labLokal = computed(() => props.titik.lab)
</script>

<template>
  <TresGroup>
    <TresGroup ref="grup">
      <TresMesh v-if="terpilih || hover" :position="[0, 0.02, 0]" :rotation="[-Math.PI / 2, 0, 0]">
        <TresRingGeometry :args="[0.34, 0.42, 32]" />
        <TresMeshBasicMaterial :color="terpilih ? '#8C83F5' : '#A099F6'" :transparent="true" :opacity="0.9" />
      </TresMesh>
      <TresMesh v-if="karyawan.runAktif > 0 && aktif" :position="[0, 0.015, 0]" :rotation="[-Math.PI / 2, 0, 0]">
        <TresRingGeometry :args="[0.44, 0.5, 32]" />
        <TresMeshBasicMaterial :color="WARNA_AKTIF" :transparent="true" :opacity="0.6" />
      </TresMesh>

      <TresGroup @click.stop="pilih" @pointer-enter="masuk" @pointer-leave="keluar">
        <!-- kaki (pivot di pinggul) -->
        <TresGroup :position="[-0.09, 0.32, 0]"><TresMesh ref="kakiKiri" :position="[0, -0.16, 0]" cast-shadow>
          <TresCylinderGeometry :args="[0.06, 0.06, 0.32, 10]" /><TresMeshStandardMaterial :color="gelap ? '#2A303C' : '#3A4150'" />
        </TresMesh></TresGroup>
        <TresGroup :position="[0.09, 0.32, 0]"><TresMesh ref="kakiKanan" :position="[0, -0.16, 0]" cast-shadow>
          <TresCylinderGeometry :args="[0.06, 0.06, 0.32, 10]" /><TresMeshStandardMaterial :color="gelap ? '#2A303C' : '#3A4150'" />
        </TresMesh></TresGroup>
        <!-- badan -->
        <TresMesh :position="[0, 0.56, 0]" cast-shadow>
          <TresCapsuleGeometry :args="[0.18, 0.34, 6, 12]" />
          <TresMeshStandardMaterial :color="warnaBadan" :roughness="0.6" />
        </TresMesh>
        <!-- lengan (pivot di bahu) -->
        <TresGroup :position="[-0.25, 0.72, 0]"><TresMesh ref="lenganKiri" :position="[0, -0.16, 0]" cast-shadow>
          <TresCapsuleGeometry :args="[0.055, 0.26, 4, 8]" /><TresMeshStandardMaterial :color="warnaBadan" :roughness="0.6" />
        </TresMesh></TresGroup>
        <TresGroup :position="[0.25, 0.72, 0]"><TresMesh ref="lenganKanan" :position="[0, -0.16, 0]" cast-shadow>
          <TresCapsuleGeometry :args="[0.055, 0.26, 4, 8]" /><TresMeshStandardMaterial :color="warnaBadan" :roughness="0.6" />
        </TresMesh></TresGroup>
        <!-- kepala -->
        <TresMesh ref="kepala" :position="[0, 0.98, 0]" cast-shadow>
          <TresSphereGeometry :args="[0.19, 18, 14]" />
          <TresMeshStandardMaterial :color="warnaKulit" :roughness="0.7" />
        </TresMesh>
        <TresMesh v-if="karyawan.isSupervisor" :position="[0, 1.17, 0]" cast-shadow>
          <TresCylinderGeometry :args="[0.14, 0.2, 0.1, 6]" />
          <TresMeshStandardMaterial color="#F2B32B" :metalness="0.4" :roughness="0.4" />
        </TresMesh>
        <TresMesh v-else :position="[0, 1.09, -0.02]" cast-shadow>
          <TresSphereGeometry :args="[0.185, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]" />
          <TresMeshStandardMaterial :color="gelap ? '#1B1F29' : '#2A2F3A'" :roughness="0.9" />
        </TresMesh>
      </TresGroup>

      <Html :position="[0, 1.62, 0]" center :occlude="false" wrapper-class="pointer-events-none select-none">
        <div class="flex flex-col items-center gap-0.5 whitespace-nowrap -translate-y-1">
          <span v-if="chip" class="text-[10px] px-1.5 py-px rounded-md bg-primary text-white shadow-sm">{{ chip }}</span>
          <span :class="['text-[11px] font-semibold px-1.5 py-0.5 rounded-md ring-1 ring-default bg-default/90 text-highlighted backdrop-blur-sm', !aktif ? 'opacity-60' : '']">{{ karyawan.name }}</span>
          <span v-if="aksi.mode === 'kerja'" class="text-[10px] px-1.5 py-px rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500/40 flex items-center gap-1">
            <span class="size-1.5 rounded-full bg-cyan-500 animate-pulse motion-reduce:animate-none" aria-hidden="true" />{{ karyawan.runAktif > 0 ? `${karyawan.runAktif} run` : 'bekerja' }}
          </span>
          <span v-else-if="['menunggu_persetujuan', 'membatalkan', 'tidak_diketahui'].includes(aksi.mode)" class="text-[10px] px-1.5 py-px rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/40">{{ LABEL_MODE[aksi.mode] }}</span>
          <span v-else-if="aksi.mode === 'rayakan'" class="text-[10px] px-1.5 py-px rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/40">selesai ✓</span>
          <span v-else-if="aksi.mode === 'gagal'" class="text-[10px] px-1.5 py-px rounded-full bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-red-500/40">gagal</span>
          <span v-else class="text-[10px] px-1.5 py-px rounded-full bg-muted text-muted ring-1 ring-default">{{ LABEL_MODE[aksi.mode] }}</span>
        </div>
      </Html>
    </TresGroup>

    <!-- asisten subagent (hanya bila ada subagent.started tanpa subagent.finished) -->
    <KantorAsistenMini v-for="i in aksi.subagentAktif" :key="`${karyawan.id}-sa-${i}`" :dari="[pos.x, 0, pos.z]" :ke="labLokal[(i - 1) % labLokal.length]!" :warna="warna" />
  </TresGroup>
</template>
