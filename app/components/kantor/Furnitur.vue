<script setup lang="ts">
/** Furnitur low-poly serbaguna: kotak berwarna dengan posisi/ukuran. */
withDefaults(defineProps<{ position?: [number, number, number], ukuran: [number, number, number], warna: string, rotasiY?: number, kasar?: number, metal?: number, transparan?: number }>(),
  { position: () => [0, 0, 0], rotasiY: 0, kasar: 0.8, metal: 0, transparan: 1 })
</script>

<template>
  <TresMesh :position="[position[0], position[1] + ukuran[1] / 2, position[2]]" :rotation="[0, rotasiY, 0]" cast-shadow receive-shadow>
    <TresBoxGeometry :args="ukuran" />
    <TresMeshStandardMaterial :color="warna" :roughness="kasar" :metalness="metal" :transparent="transparan < 1" :opacity="transparan" />
  </TresMesh>
</template>
