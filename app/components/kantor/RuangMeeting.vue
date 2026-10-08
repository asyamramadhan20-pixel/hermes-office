<script setup lang="ts">
/** Ruang meeting: meja panjang, 6 kursi, layar dinding. Dipakai karakter yang menunggu persetujuan. */
withDefaults(defineProps<{ position: [number, number, number], gelap?: boolean, jumlahMenunggu?: number }>(), { gelap: false, jumlahMenunggu: 0 })
const KURSI: [number, number][] = [[-1.7, -0.9], [0, -0.9], [1.7, -0.9], [-1.7, 0.9], [0, 0.9], [1.7, 0.9]]
</script>

<template>
  <KantorRuangan :position="position" :lebar="6.8" :dalam="4.6" nama="Ruang Meeting" :warna-lantai="gelap ? '#232A3A' : '#E4E9F2'" warna-aksen="#6F63EA" :gelap="gelap" kaca
    :keterangan="jumlahMenunggu > 0 ? `${jumlahMenunggu} menunggu persetujuan` : 'kosong'">
    <!-- meja panjang -->
    <KantorFurnitur :position="[0, 0.1, 0]" :ukuran="[4.6, 0.08, 1.3]" :warna="gelap ? '#3A4150' : '#F3F4F6'" />
    <KantorFurnitur :position="[0, 0.1, 0]" :ukuran="[0.3, 0.68, 0.3]" :warna="gelap ? '#2A303C' : '#CBD1DA'" />
    <KantorFurnitur :position="[0, 0.78, 0]" :ukuran="[4.6, 0.06, 1.3]" :warna="gelap ? '#3A4150' : '#F3F4F6'" />
    <!-- kursi -->
    <template v-for="([x, z], i) in KURSI" :key="i">
      <KantorFurnitur :position="[x, 0.1, z]" :ukuran="[0.5, 0.42, 0.5]" :warna="gelap ? '#4A3FA0' : '#8C83F5'" />
      <KantorFurnitur :position="[x, 0.52, z + (z < 0 ? -0.2 : 0.2)]" :ukuran="[0.5, 0.5, 0.1]" :warna="gelap ? '#4A3FA0' : '#8C83F5'" />
    </template>
    <!-- layar dinding -->
    <KantorFurnitur :position="[0, 0.9, -2.2]" :ukuran="[2.2, 1.2, 0.08]" :warna="gelap ? '#1B1F29' : '#2A2F3A'" />
    <KantorFurnitur :position="[0, 1.0, -2.14]" :ukuran="[2.0, 1.0, 0.02]" :warna="gelap ? '#2E3442' : '#9AA3B5'" />
    <KantorTanaman :position="[-3.0, 0.1, 1.8]" :skala="0.8" />
  </KantorRuangan>
</template>
