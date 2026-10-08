<script setup lang="ts">
/** Cangkang ruangan: lantai, dinding belakang & samping rendah (kaca opsional), papan nama. */
import { Html } from '@tresjs/cientos'
withDefaults(defineProps<{
  position: [number, number, number]
  lebar: number
  dalam: number
  nama: string
  ikon?: string
  warnaLantai: string
  warnaAksen: string
  gelap?: boolean
  kaca?: boolean
  keterangan?: string
}>(), { ikon: '', gelap: false, kaca: false, keterangan: '' })
</script>

<template>
  <TresGroup :position="position">
    <!-- lantai -->
    <TresMesh :position="[0, 0.05, 0]" receive-shadow>
      <TresBoxGeometry :args="[lebar, 0.1, dalam]" />
      <TresMeshStandardMaterial :color="warnaLantai" :roughness="0.95" />
    </TresMesh>
    <!-- dinding belakang -->
    <TresMesh :position="[0, 1.1, -dalam / 2 + 0.06]" cast-shadow receive-shadow>
      <TresBoxGeometry :args="[lebar, 2.1, 0.12]" />
      <TresMeshStandardMaterial :color="gelap ? '#2A2F3A' : '#E9ECF0'" :roughness="0.6" />
    </TresMesh>
    <!-- dinding samping rendah (kaca bila diminta) -->
    <TresMesh v-for="(x, i) in [-lebar / 2 + 0.06, lebar / 2 - 0.06]" :key="i" :position="[x, kaca ? 1.0 : 0.5, -dalam * 0.1]" cast-shadow receive-shadow>
      <TresBoxGeometry :args="[0.12, kaca ? 1.9 : 0.9, dalam * 0.8]" />
      <TresMeshStandardMaterial :color="kaca ? (gelap ? '#4A5A8A' : '#BFD3F5') : (gelap ? '#2A2F3A' : '#E9ECF0')" :transparent="kaca" :opacity="kaca ? 0.45 : 1" :roughness="kaca ? 0.15 : 0.6" :metalness="kaca ? 0.2 : 0" />
    </TresMesh>
    <!-- garis aksen di atas dinding belakang -->
    <TresMesh :position="[0, 2.2, -dalam / 2 + 0.06]">
      <TresBoxGeometry :args="[lebar, 0.08, 0.16]" />
      <TresMeshStandardMaterial :color="warnaAksen" />
    </TresMesh>
    <slot />
    <Html :position="[0, 2.7, -dalam / 2 + 0.2]" center :occlude="false" wrapper-class="pointer-events-none select-none">
      <div class="whitespace-nowrap text-center px-2.5 py-1 rounded-md ring-1 ring-default bg-default/90 backdrop-blur-sm">
        <p class="text-[11px] font-semibold text-highlighted leading-none flex items-center gap-1.5 justify-center">
          <span class="size-2 rounded-sm" :style="{ background: warnaAksen }" aria-hidden="true" />{{ nama }}
        </p>
        <p v-if="keterangan" class="text-[10px] text-muted mt-0.5 leading-none">{{ keterangan }}</p>
      </div>
    </Html>
  </TresGroup>
</template>
