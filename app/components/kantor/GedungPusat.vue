<script setup lang="ts">
/** HQ "AI Agent Office": ruang supervisor (MasterCEO), kaca depan, atap aksen. */
import { Html } from '@tresjs/cientos'
import type { KaryawanAI } from '~~/shared/kontrak'
import type { AksiKarakter } from '~/utils/koreografi'
import { warnaDept, kurang, TITIK, type Titik } from '~/utils/kantor3d'
import type { Lokasi } from './KarakterAI.vue'

const props = withDefaults(defineProps<{
  supervisor: KaryawanAI | null
  aksi: AksiKarakter
  namaOrg: string
  position: Titik
  gelap?: boolean
  terpilihId?: string | null
}>(), { gelap: false, terpilihId: null })
const emit = defineEmits<{ pilih: [karyawan: KaryawanAI], lokasi: [id: string, lokasi: Lokasi] }>()
const warna = computed(() => warnaDept('Manajemen', props.gelap))
const lokal = (t: Titik) => kurang(t, props.position)
const titik = computed(() => ({
  meja: [0, 0, 0.3] as Titik, hqDepan: lokal(TITIK.hqDepan), meeting: lokal(TITIK.meetingKursi[0]!),
  lounge: lokal(TITIK.lounge[1]!), pantry: lokal(TITIK.pantry[1]!), lab: TITIK.labMeja.map(lokal)
}))
</script>

<template>
  <TresGroup :position="position">
    <TresMesh :position="[0, 0.06, 0]" receive-shadow>
      <TresBoxGeometry :args="[7, 0.12, 4.6]" />
      <TresMeshStandardMaterial :color="warna.lantai" :roughness="0.9" />
    </TresMesh>
    <!-- dinding belakang + kaca -->
    <TresMesh :position="[0, 1.3, -2.2]" cast-shadow receive-shadow>
      <TresBoxGeometry :args="[6.9, 2.4, 0.12]" />
      <TresMeshStandardMaterial :color="gelap ? '#2A2F3A' : '#E9ECF0'" :roughness="0.5" />
    </TresMesh>
    <TresMesh :position="[0, 1.35, -2.12]">
      <TresPlaneGeometry :args="[6.0, 1.6]" />
      <TresMeshStandardMaterial :color="gelap ? '#3A4A7A' : '#BFD3F5'" :transparent="true" :opacity="0.7" :roughness="0.2" :metalness="0.3" />
    </TresMesh>
    <TresMesh v-for="(x, i) in [-3.44, 3.44]" :key="i" :position="[x, 1.3, -0.6]" cast-shadow receive-shadow>
      <TresBoxGeometry :args="[0.12, 2.4, 3.2]" />
      <TresMeshStandardMaterial :color="gelap ? '#2A2F3A' : '#E9ECF0'" :roughness="0.5" />
    </TresMesh>
    <TresMesh :position="[0, 2.56, -0.6]" cast-shadow>
      <TresBoxGeometry :args="[7.3, 0.14, 3.5]" />
      <TresMeshStandardMaterial :color="warna.aksen" :roughness="0.6" />
    </TresMesh>
    <!-- meja supervisor + lemari -->
    <KantorMejaKerja :position="[0, 0.12, -0.5]" :layar="supervisor && supervisor.runAktif > 0 ? 'aktif' : 'mati'" :gelap="gelap" />
    <KantorFurnitur :position="[-2.6, 0.12, -1.7]" :ukuran="[1.2, 1.6, 0.5]" :warna="gelap ? '#3A3020' : '#C58B4E'" />
    <KantorFurnitur :position="[2.4, 0.12, -1.6]" :ukuran="[1.6, 0.5, 0.7]" :warna="gelap ? '#4A3FA0' : '#8C83F5'" />
    <KantorTanaman :position="[-3.0, 0.12, 1.6]" :skala="0.9" />
    <KantorTanaman :position="[3.0, 0.12, 1.6]" :skala="0.9" />
    <TresGroup v-if="supervisor" :position="[0, 0.12, 0]">
      <KantorKarakterAI :karyawan="supervisor" :aksi="aksi" :titik="titik" :warna="warna.badan" :gelap="gelap" :terpilih="supervisor.id === terpilihId" @pilih="emit('pilih', $event)" @lokasi="(id, l) => emit('lokasi', id, l)" />
    </TresGroup>

    <Html :position="[0, 3.0, -0.6]" center :occlude="false" wrapper-class="pointer-events-none select-none">
      <div class="whitespace-nowrap text-center px-3 py-1.5 rounded-lg ring-1 ring-primary/40 bg-default/95 backdrop-blur-sm">
        <p class="text-[10px] uppercase tracking-wider text-muted leading-none">{{ namaOrg }}</p>
        <p class="text-xs font-semibold text-primary mt-0.5 leading-none">AI Agent Office · HQ</p>
      </div>
    </Html>
  </TresGroup>
</template>
