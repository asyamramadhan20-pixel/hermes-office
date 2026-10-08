<script setup lang="ts">
/**
 * Kanvas 3D kantor virtual (client-only). Semua yang tampak bergerak/menyala berasal dari data
 * `karyawan[].runAktif` (agent_runs). Kamera orbit terbatas; klik karakter → emit pilih.
 */
import { OrbitControls } from '@tresjs/cientos'
import { NoToneMapping, SRGBColorSpace } from 'three'
import type { KaryawanAI } from '~~/shared/kontrak'
import { posisiZona } from '~/utils/kantor3d'

const props = withDefaults(defineProps<{
  karyawan: KaryawanAI[]
  namaOrg: string
  terpilihId?: string | null
}>(), { terpilihId: null })
const emit = defineEmits<{ pilih: [karyawan: KaryawanAI] }>()

const colorMode = useColorMode()
const gelap = computed(() => colorMode.value === 'dark')
const latar = computed(() => gelap.value ? '#101319' : '#F4F6F8')

/** Kamera lebih jauh di layar sempit supaya seluruh lantai terlihat. */
// Komponen ini client-only, jadi `window` tersedia saat setup; dihitung sebelum kamera dibuat.
const sempit = ref(typeof window !== 'undefined' && window.innerWidth < 768)
const posisiKamera = computed<[number, number, number]>(() => sempit.value ? [0, 14, 17] : [0, 10.5, 12.5])
const fov = computed(() => sempit.value ? 64 : 38)

const supervisor = computed(() => props.karyawan.find(k => k.isSupervisor) ?? null)
const departemen = computed(() => {
  const peta = new Map<string, KaryawanAI[]>()
  for (const k of props.karyawan.filter(k => !k.isSupervisor)) peta.set(k.department, [...(peta.get(k.department) ?? []), k])
  return [...peta.entries()].sort((a, b) => a[0].localeCompare(b[0], 'id')).map(([nama, daftar]) => ({ nama, daftar }))
})
</script>

<template>
  <TresCanvas :clear-color="latar" shadows :tone-mapping="NoToneMapping" :output-color-space="SRGBColorSpace" :dpr="[1, 1.5]">
    <TresPerspectiveCamera :position="posisiKamera" :fov="fov" :look-at="[0, 0.4, 0.2]" />
    <OrbitControls :enable-pan="false" :min-distance="9" :max-distance="26" :min-polar-angle="0.5" :max-polar-angle="1.25" :target="[0, 0.4, 0.2]" />

    <TresAmbientLight :intensity="gelap ? 0.6 : 0.9" />
    <TresDirectionalLight :position="[4, 14, 8]" :intensity="gelap ? 1.6 : 2.2" cast-shadow :shadow-mapSize-width="2048" :shadow-mapSize-height="2048" />
    <TresHemisphereLight :args="[gelap ? '#3A4A7A' : '#DCE8FF', gelap ? '#101319' : '#C9CFD8', 0.5]" />

    <!-- platform utama -->
    <TresMesh :position="[0, -0.2, 0.3]" receive-shadow>
      <TresCylinderGeometry :args="[10.2, 10.6, 0.4, 8]" />
      <TresMeshStandardMaterial :color="gelap ? '#1E2330' : '#FFFFFF'" :roughness="0.95" />
    </TresMesh>
    <TresMesh :position="[0, -0.42, 0.3]">
      <TresCylinderGeometry :args="[10.6, 10.0, 0.08, 8]" />
      <TresMeshStandardMaterial :color="gelap ? '#2A2F3A' : '#D5DAE1'" />
    </TresMesh>

    <KantorGedungPusat :position="[0, 0, -3.8]" :supervisor="supervisor" :nama-org="namaOrg" :gelap="gelap" :terpilih-id="terpilihId" @pilih="emit('pilih', $event)" />
    <KantorZonaDepartemen
      v-for="(d, i) in departemen" :key="d.nama"
      :nama="d.nama" :karyawan="d.daftar" :position="posisiZona(i, departemen.length)" :gelap="gelap" :terpilih-id="terpilihId"
      @pilih="emit('pilih', $event)"
    />
  </TresCanvas>
</template>
