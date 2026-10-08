<script setup lang="ts">
/** Zona heksagonal satu departemen: lantai berwarna, meja per karyawan, tanaman, karakter. */
import { Html } from '@tresjs/cientos'
import type { KaryawanAI } from '~~/shared/kontrak'
import { warnaDept, posisiKaryawan } from '~/utils/kantor3d'

const props = withDefaults(defineProps<{
  nama: string
  karyawan: KaryawanAI[]
  position?: [number, number, number]
  gelap?: boolean
  terpilihId?: string | null
}>(), { position: () => [0, 0, 0], gelap: false, terpilihId: null })
const emit = defineEmits<{ pilih: [karyawan: KaryawanAI] }>()

const warna = computed(() => warnaDept(props.nama, props.gelap))
const runBerjalan = computed(() => props.karyawan.reduce((n, k) => n + k.runAktif, 0))
const radius = computed(() => 1.75 + Math.max(0, props.karyawan.length - 2) * 0.3)
</script>

<template>
  <TresGroup :position="position">
    <!-- lantai heksagonal -->
    <TresMesh :position="[0, 0.06, 0]" receive-shadow>
      <TresCylinderGeometry :args="[radius, radius, 0.12, 6]" />
      <TresMeshStandardMaterial :color="warna.lantai" :roughness="0.9" />
    </TresMesh>
    <!-- tepi aksen -->
    <TresMesh :position="[0, 0.125, 0]" :rotation="[-Math.PI / 2, 0, 0]">
      <TresRingGeometry :args="[radius - 0.08, radius, 6]" />
      <TresMeshBasicMaterial :color="warna.aksen" :transparent="true" :opacity="0.85" />
    </TresMesh>

    <!-- meja + karakter per karyawan -->
    <template v-for="(k, j) in karyawan" :key="k.id">
      <KantorMejaKerja :position="[posisiKaryawan(j, karyawan.length)[0], 0.12, posisiKaryawan(j, karyawan.length)[2] - 0.75]" :aktif="k.runAktif > 0 && k.isActive" :gelap="gelap" />
      <KantorKarakterAI :karyawan="k" :position="[posisiKaryawan(j, karyawan.length)[0], 0.12, posisiKaryawan(j, karyawan.length)[2]]" :warna="warna.badan" :gelap="gelap" :terpilih="k.id === terpilihId" @pilih="emit('pilih', $event)" />
    </template>

    <KantorTanaman :position="[radius - 0.6, 0.12, radius * 0.35]" :skala="0.8" />

    <!-- papan nama departemen -->
    <Html :position="[0, 2.3, -radius + 0.6]" center :occlude="false" wrapper-class="pointer-events-none select-none">
      <div class="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold px-2 py-1 rounded-md ring-1 ring-default bg-default/90 backdrop-blur-sm text-highlighted">
        <span class="size-2 rounded-sm" :style="{ background: warna.aksen }" aria-hidden="true" />
        {{ nama }}
        <span v-if="runBerjalan > 0" class="text-cyan-700 dark:text-cyan-300 font-medium">· {{ runBerjalan }} run</span>
        <span v-else class="text-muted font-normal">· tenang</span>
      </div>
    </Html>
  </TresGroup>
</template>
