<script setup lang="ts">
withDefaults(defineProps<{ position?: [number, number, number], skala?: number }>(), { position: () => [0, 0, 0], skala: 1 })
</script>

<template>
  <TresGroup :position="position" :scale="skala">
    <TresMesh :position="[0, 0.18, 0]" cast-shadow>
      <TresCylinderGeometry :args="[0.16, 0.13, 0.36, 12]" />
      <TresMeshStandardMaterial color="#D9A066" :roughness="0.9" />
    </TresMesh>
    <TresMesh :position="[0, 0.62, 0]" cast-shadow>
      <TresSphereGeometry :args="[0.32, 14, 10]" />
      <TresMeshStandardMaterial color="#3E9B5D" :roughness="0.8" />
    </TresMesh>
    <TresMesh :position="[0.16, 0.8, 0.08]" cast-shadow>
      <TresSphereGeometry :args="[0.2, 12, 8]" />
      <TresMeshStandardMaterial color="#56B274" :roughness="0.8" />
    </TresMesh>
  </TresGroup>
</template>
