<script setup lang="ts">
/** Asisten kecil = subagent Hermes yang sedang berjalan (ada subagent.started tanpa subagent.finished). Berjalan dari induk ke lab. */
import { shallowRef } from 'vue'
import type { Group } from 'three'
import { useLoop } from '@tresjs/core'
import { WARNA_AKTIF } from '~/utils/kantor3d'

const props = defineProps<{ dari: [number, number, number], ke: [number, number, number], warna: string }>()
const grup = shallowRef<Group | null>(null)
const pos = { x: props.dari[0], z: props.dari[2] }
const sampai = ref(false)

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta, elapsed }) => {
  const g = grup.value
  if (!g) return
  const dx = props.ke[0] - pos.x, dz = props.ke[2] - pos.z
  const jarak = Math.hypot(dx, dz)
  if (jarak > 0.05) {
    const langkah = Math.min(jarak, 2.2 * delta)
    pos.x += dx / jarak * langkah; pos.z += dz / jarak * langkah
    g.rotation.y = Math.atan2(dx, dz)
    g.position.y = Math.abs(Math.sin(elapsed * 14)) * 0.05
    sampai.value = false
  } else {
    sampai.value = true
    g.rotation.y = Math.PI
    g.position.y = Math.sin(elapsed * 6) * 0.02 // "mengetik" kecil di lab
  }
  g.position.x = pos.x; g.position.z = pos.z
})
</script>

<template>
  <TresGroup ref="grup" :scale="0.55">
    <TresMesh :position="[0, 0.02, 0]" :rotation="[-Math.PI / 2, 0, 0]">
      <TresRingGeometry :args="[0.4, 0.5, 24]" />
      <TresMeshBasicMaterial :color="WARNA_AKTIF" :transparent="true" :opacity="0.7" />
    </TresMesh>
    <TresMesh :position="[0, 0.5, 0]" cast-shadow>
      <TresCapsuleGeometry :args="[0.18, 0.3, 6, 12]" />
      <TresMeshStandardMaterial :color="warna" :roughness="0.6" />
    </TresMesh>
    <TresMesh :position="[0, 0.95, 0]" cast-shadow>
      <TresSphereGeometry :args="[0.19, 16, 12]" />
      <TresMeshStandardMaterial color="#F2C9A8" />
    </TresMesh>
    <TresMesh :position="[0, 1.18, 0]">
      <TresSphereGeometry :args="[0.07, 10, 8]" />
      <TresMeshStandardMaterial :color="WARNA_AKTIF" :emissive="WARNA_AKTIF" :emissive-intensity="1" />
    </TresMesh>
  </TresGroup>
</template>
