<script setup lang="ts">
/** Meja + monitor. Layar: 'mati' redup · 'aktif' cyan (run berjalan) · 'peringatan' amber berkedip (batal/tidak diketahui). */
import { shallowRef } from 'vue'
import type { MeshStandardMaterial } from 'three'
import { useLoop } from '@tresjs/core'
import { WARNA_AKTIF, WARNA_PERINGATAN } from '~/utils/kantor3d'

const props = withDefaults(defineProps<{ position?: [number, number, number], layar?: 'mati' | 'aktif' | 'peringatan', gelap?: boolean, rotasiY?: number }>(), { position: () => [0, 0, 0], layar: 'mati', gelap: false, rotasiY: 0 })
const materialLayar = shallowRef<MeshStandardMaterial | null>(null)
const warnaLayar = computed(() => props.layar === 'aktif' ? WARNA_AKTIF : props.layar === 'peringatan' ? WARNA_PERINGATAN : (props.gelap ? '#2E3442' : '#9AA3B5'))

const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => {
  const m = materialLayar.value
  if (!m) return
  m.emissiveIntensity = props.layar === 'aktif' ? 1.3 : props.layar === 'peringatan' ? 0.6 + Math.abs(Math.sin(elapsed * 4)) * 1.2 : 0
})
</script>

<template>
  <TresGroup :position="position" :rotation="[0, rotasiY, 0]">
    <TresMesh :position="[0, 0.72, 0]" cast-shadow receive-shadow>
      <TresBoxGeometry :args="[1.1, 0.06, 0.6]" />
      <TresMeshStandardMaterial :color="gelap ? '#3A4150' : '#F3F4F6'" :roughness="0.7" />
    </TresMesh>
    <TresMesh v-for="(x, i) in [-0.46, 0.46]" :key="i" :position="[x, 0.36, 0]" cast-shadow>
      <TresBoxGeometry :args="[0.06, 0.72, 0.5]" />
      <TresMeshStandardMaterial :color="gelap ? '#2A303C' : '#CBD1DA'" />
    </TresMesh>
    <TresMesh :position="[0, 1.02, -0.17]" cast-shadow>
      <TresBoxGeometry :args="[0.64, 0.4, 0.04]" />
      <TresMeshStandardMaterial :color="gelap ? '#1B1F29' : '#2A2F3A'" />
    </TresMesh>
    <TresMesh :position="[0, 1.02, -0.146]">
      <TresPlaneGeometry :args="[0.58, 0.34]" />
      <TresMeshStandardMaterial ref="materialLayar" :color="warnaLayar" :emissive="layar === 'mati' ? '#000000' : warnaLayar" :emissive-intensity="layar === 'aktif' ? 1.3 : 0" />
    </TresMesh>
    <TresMesh :position="[0, 0.78, -0.17]">
      <TresBoxGeometry :args="[0.14, 0.1, 0.1]" />
      <TresMeshStandardMaterial :color="gelap ? '#1B1F29' : '#2A2F3A'" />
    </TresMesh>
    <!-- keyboard + cangkir -->
    <TresMesh :position="[0, 0.76, 0.08]">
      <TresBoxGeometry :args="[0.36, 0.02, 0.14]" />
      <TresMeshStandardMaterial :color="gelap ? '#2A303C' : '#CBD1DA'" />
    </TresMesh>
    <TresMesh :position="[0.4, 0.8, 0.1]">
      <TresCylinderGeometry :args="[0.05, 0.04, 0.09, 10]" />
      <TresMeshStandardMaterial color="#FFFFFF" />
    </TresMesh>
  </TresGroup>
</template>
