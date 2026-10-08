<script setup lang="ts">
/** Pantry: konter, kulkas, mesin kopi, meja bundar + bangku. Tujuan "ngopi" saat idle. */
withDefaults(defineProps<{ position: [number, number, number], gelap?: boolean, jumlahNgopi?: number }>(), { gelap: false, jumlahNgopi: 0 })
</script>

<template>
  <KantorRuangan :position="position" :lebar="6.8" :dalam="4.6" nama="Pantry" :warna-lantai="gelap ? '#2E2A20' : '#FBF1E3'" warna-aksen="#E39B2C" :gelap="gelap"
    :keterangan="jumlahNgopi > 0 ? `${jumlahNgopi} sedang ngopi` : 'sepi'">
    <!-- konter -->
    <KantorFurnitur :position="[0.6, 0.1, -1.7]" :ukuran="[4.2, 0.9, 0.8]" :warna="gelap ? '#4A4030' : '#D9A066'" />
    <KantorFurnitur :position="[0.6, 1.0, -1.7]" :ukuran="[4.3, 0.06, 0.85]" :warna="gelap ? '#3A4150' : '#F3F4F6'" />
    <!-- mesin kopi -->
    <KantorFurnitur :position="[1.6, 1.06, -1.8]" :ukuran="[0.5, 0.5, 0.4]" :warna="gelap ? '#1B1F29' : '#2A2F3A'" :kasar="0.4" :metal="0.5" />
    <KantorFurnitur :position="[1.6, 1.3, -1.58]" :ukuran="[0.16, 0.08, 0.04]" :warna="'#22D3EE'" />
    <!-- kulkas -->
    <KantorFurnitur :position="[-2.6, 0.1, -1.6]" :ukuran="[0.9, 1.9, 0.8]" :warna="gelap ? '#9AA3B5' : '#E9ECF0'" :kasar="0.3" :metal="0.4" />
    <KantorFurnitur :position="[-2.2, 1.0, -1.18]" :ukuran="[0.05, 0.6, 0.04]" :warna="gelap ? '#2A303C' : '#667084'" />
    <!-- meja bundar + bangku -->
    <TresMesh :position="[0.4, 0.74, 0.9]" cast-shadow>
      <TresCylinderGeometry :args="[0.75, 0.75, 0.06, 20]" />
      <TresMeshStandardMaterial :color="gelap ? '#3A4150' : '#F3F4F6'" />
    </TresMesh>
    <TresMesh :position="[0.4, 0.4, 0.9]">
      <TresCylinderGeometry :args="[0.08, 0.12, 0.7, 10]" />
      <TresMeshStandardMaterial :color="gelap ? '#2A303C' : '#CBD1DA'" />
    </TresMesh>
    <TresMesh v-for="(a, i) in [0, 2.1, 4.2]" :key="i" :position="[0.4 + Math.cos(a) * 1.15, 0.33, 0.9 + Math.sin(a) * 1.15]" cast-shadow>
      <TresCylinderGeometry :args="[0.22, 0.22, 0.45, 12]" />
      <TresMeshStandardMaterial :color="gelap ? '#7A5A2A' : '#E39B2C'" />
    </TresMesh>
    <KantorTanaman :position="[2.9, 0.1, 1.7]" :skala="0.8" />
  </KantorRuangan>
</template>
