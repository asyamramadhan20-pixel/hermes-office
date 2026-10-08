<script setup lang="ts">
/** Ruang santai: sofa L, meja kopi, karpet, tanaman. Tujuan jalan-jalan saat idle. */
withDefaults(defineProps<{ position: [number, number, number], gelap?: boolean, jumlahSantai?: number }>(), { gelap: false, jumlahSantai: 0 })
</script>

<template>
  <KantorRuangan :position="position" :lebar="6.8" :dalam="4.6" nama="Ruang Santai" :warna-lantai="gelap ? '#2A2430' : '#F1E8F6'" warna-aksen="#D94C8F" :gelap="gelap"
    :keterangan="jumlahSantai > 0 ? `${jumlahSantai} sedang istirahat` : 'sepi'">
    <!-- karpet -->
    <KantorFurnitur :position="[0.4, 0.1, 0.2]" :ukuran="[3.6, 0.02, 2.6]" :warna="gelap ? '#3A2F45' : '#E6D6EE'" />
    <!-- sofa L -->
    <KantorFurnitur :position="[0.4, 0.12, -1.0]" :ukuran="[3.0, 0.5, 0.9]" :warna="gelap ? '#5A3F70' : '#B48CD8'" />
    <KantorFurnitur :position="[0.4, 0.62, -1.35]" :ukuran="[3.0, 0.5, 0.2]" :warna="gelap ? '#5A3F70' : '#B48CD8'" />
    <KantorFurnitur :position="[-1.5, 0.12, 0.2]" :ukuran="[0.9, 0.5, 2.2]" :warna="gelap ? '#5A3F70' : '#B48CD8'" />
    <KantorFurnitur :position="[-1.85, 0.62, 0.2]" :ukuran="[0.2, 0.5, 2.2]" :warna="gelap ? '#5A3F70' : '#B48CD8'" />
    <!-- meja kopi -->
    <KantorFurnitur :position="[0.6, 0.1, 0.4]" :ukuran="[1.2, 0.4, 0.7]" :warna="gelap ? '#4A4030' : '#D9A066'" />
    <!-- rak buku -->
    <KantorFurnitur :position="[2.6, 0.1, -1.6]" :ukuran="[1.2, 1.7, 0.4]" :warna="gelap ? '#3A3020' : '#C58B4E'" />
    <KantorFurnitur v-for="(y, i) in [0.5, 0.95, 1.4]" :key="i" :position="[2.6, y, -1.55]" :ukuran="[1.0, 0.25, 0.3]" :warna="['#E8603C', '#2E9E6B', '#6F63EA'][i]!" />
    <KantorTanaman :position="[2.8, 0.1, 1.5]" :skala="1.1" />
    <KantorTanaman :position="[-2.8, 0.1, -1.6]" :skala="0.9" />
  </KantorRuangan>
</template>
