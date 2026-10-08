<script setup lang="ts">
/** Lab / ruang server: rak server & meja kerja asisten subagent. */
import { WARNA_AKTIF } from '~/utils/kantor3d'
withDefaults(defineProps<{ position: [number, number, number], gelap?: boolean, jumlahSubagent?: number }>(), { gelap: false, jumlahSubagent: 0 })
</script>

<template>
  <KantorRuangan :position="position" :lebar="6.8" :dalam="4.6" nama="Lab Subagent" :warna-lantai="gelap ? '#1F2A2E' : '#E0EEF0'" warna-aksen="#22D3EE" :gelap="gelap"
    :keterangan="jumlahSubagent > 0 ? `${jumlahSubagent} subagent aktif` : 'tidak ada subagent'">
    <!-- rak server di dinding belakang -->
    <template v-for="x in [-2.6, -1.8, 1.8, 2.6]" :key="x">
      <KantorFurnitur :position="[x, 0.1, -1.9]" :ukuran="[0.6, 1.8, 0.5]" :warna="gelap ? '#1B1F29' : '#2A2F3A'" :kasar="0.4" :metal="0.5" />
      <KantorFurnitur v-for="y in [0.4, 0.8, 1.2, 1.6]" :key="y" :position="[x, y, -1.64]" :ukuran="[0.4, 0.04, 0.02]" :warna="WARNA_AKTIF" />
    </template>
    <!-- meja panjang asisten -->
    <KantorFurnitur :position="[-1.3, 0.1, -0.4]" :ukuran="[4.0, 0.06, 0.7]" :warna="gelap ? '#3A4150' : '#F3F4F6'" />
    <KantorFurnitur :position="[-1.3, 0.1, -0.4]" :ukuran="[3.8, 0.66, 0.1]" :warna="gelap ? '#2A303C' : '#CBD1DA'" />
    <KantorFurnitur :position="[-1.3, 0.1, 1.2]" :ukuran="[4.0, 0.06, 0.7]" :warna="gelap ? '#3A4150' : '#F3F4F6'" />
    <KantorFurnitur :position="[-1.3, 0.1, 1.2]" :ukuran="[3.8, 0.66, 0.1]" :warna="gelap ? '#2A303C' : '#CBD1DA'" />
    <KantorTanaman :position="[2.9, 0.1, 1.7]" :skala="0.7" />
  </KantorRuangan>
</template>
