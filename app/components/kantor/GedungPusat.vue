<script setup lang="ts">
/** Gedung "AI Agent Office" di tengah-belakang: rumah supervisor (MasterCEO). */
import { Html } from '@tresjs/cientos'
import type { KaryawanAI } from '~~/shared/kontrak'
import { warnaDept } from '~/utils/kantor3d'

const props = withDefaults(defineProps<{
  supervisor: KaryawanAI | null
  namaOrg: string
  position?: [number, number, number]
  gelap?: boolean
  terpilihId?: string | null
}>(), { position: () => [0, 0, -3.2], gelap: false, terpilihId: null })
const emit = defineEmits<{ pilih: [karyawan: KaryawanAI] }>()
const warna = computed(() => warnaDept('Manajemen', props.gelap))
</script>

<template>
  <TresGroup :position="position">
    <!-- lantai gedung -->
    <TresMesh :position="[0, 0.06, 0]" receive-shadow>
      <TresBoxGeometry :args="[5.2, 0.12, 3.2]" />
      <TresMeshStandardMaterial :color="warna.lantai" :roughness="0.9" />
    </TresMesh>
    <!-- dinding belakang kaca -->
    <TresMesh :position="[0, 1.2, -1.45]" cast-shadow receive-shadow>
      <TresBoxGeometry :args="[5.0, 2.2, 0.12]" />
      <TresMeshStandardMaterial :color="gelap ? '#2A2F3A' : '#E9ECF0'" :roughness="0.5" />
    </TresMesh>
    <TresMesh :position="[0, 1.2, -1.38]">
      <TresPlaneGeometry :args="[4.4, 1.5]" />
      <TresMeshStandardMaterial :color="gelap ? '#3A4A7A' : '#BFD3F5'" :transparent="true" :opacity="0.7" :roughness="0.2" :metalness="0.3" />
    </TresMesh>
    <!-- dinding samping -->
    <TresMesh v-for="(x, i) in [-2.54, 2.54]" :key="i" :position="[x, 1.2, -0.3]" cast-shadow receive-shadow>
      <TresBoxGeometry :args="[0.12, 2.2, 2.4]" />
      <TresMeshStandardMaterial :color="gelap ? '#2A2F3A' : '#E9ECF0'" :roughness="0.5" />
    </TresMesh>
    <!-- atap -->
    <TresMesh :position="[0, 2.36, -0.3]" cast-shadow>
      <TresBoxGeometry :args="[5.4, 0.12, 2.7]" />
      <TresMeshStandardMaterial :color="warna.aksen" :roughness="0.6" />
    </TresMesh>
    <!-- meja supervisor + karakter -->
    <KantorMejaKerja :position="[0, 0.12, -0.55]" :aktif="!!supervisor && supervisor.runAktif > 0" :gelap="gelap" />
    <KantorKarakterAI v-if="supervisor" :karyawan="supervisor" :position="[0, 0.12, 0.25]" :warna="warna.badan" :gelap="gelap" :terpilih="supervisor.id === terpilihId" @pilih="emit('pilih', $event)" />
    <KantorTanaman :position="[-2.1, 0.12, 0.9]" :skala="0.9" />
    <KantorTanaman :position="[2.1, 0.12, 0.9]" :skala="0.9" />

    <Html :position="[0, 2.75, -0.3]" center :occlude="false" wrapper-class="pointer-events-none select-none">
      <div class="whitespace-nowrap text-center px-3 py-1.5 rounded-lg ring-1 ring-primary/40 bg-default/95 backdrop-blur-sm">
        <p class="text-[10px] uppercase tracking-wider text-muted leading-none">{{ namaOrg }}</p>
        <p class="text-xs font-semibold text-primary mt-0.5 leading-none">AI Agent Office</p>
      </div>
    </Html>
  </TresGroup>
</template>
