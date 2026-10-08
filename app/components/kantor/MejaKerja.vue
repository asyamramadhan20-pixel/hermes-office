<script setup lang="ts">
/** Meja + monitor. Layar menyala cyan hanya bila `aktif` (ada run berjalan). */
import { WARNA_AKTIF } from '~/utils/kantor3d'
withDefaults(defineProps<{ position?: [number, number, number], aktif?: boolean, gelap?: boolean }>(), { position: () => [0, 0, 0], aktif: false, gelap: false })
</script>

<template>
  <TresGroup :position="position">
    <!-- papan meja -->
    <TresMesh :position="[0, 0.72, 0]" cast-shadow receive-shadow>
      <TresBoxGeometry :args="[1.0, 0.06, 0.55]" />
      <TresMeshStandardMaterial :color="gelap ? '#3A4150' : '#F3F4F6'" :roughness="0.7" />
    </TresMesh>
    <!-- kaki -->
    <TresMesh v-for="(x, i) in [-0.42, 0.42]" :key="i" :position="[x, 0.36, 0]" cast-shadow>
      <TresBoxGeometry :args="[0.06, 0.72, 0.45]" />
      <TresMeshStandardMaterial :color="gelap ? '#2A303C' : '#CBD1DA'" />
    </TresMesh>
    <!-- monitor -->
    <TresMesh :position="[0, 1.0, -0.15]" cast-shadow>
      <TresBoxGeometry :args="[0.6, 0.38, 0.04]" />
      <TresMeshStandardMaterial :color="gelap ? '#1B1F29' : '#2A2F3A'" />
    </TresMesh>
    <TresMesh :position="[0, 1.0, -0.126]">
      <TresPlaneGeometry :args="[0.54, 0.32]" />
      <TresMeshStandardMaterial
        :color="aktif ? WARNA_AKTIF : (gelap ? '#2E3442' : '#9AA3B5')"
        :emissive="aktif ? WARNA_AKTIF : '#000000'"
        :emissive-intensity="aktif ? 1.4 : 0"
      />
    </TresMesh>
    <TresMesh :position="[0, 0.78, -0.15]">
      <TresBoxGeometry :args="[0.14, 0.1, 0.1]" />
      <TresMeshStandardMaterial :color="gelap ? '#1B1F29' : '#2A2F3A'" />
    </TresMesh>
  </TresGroup>
</template>
