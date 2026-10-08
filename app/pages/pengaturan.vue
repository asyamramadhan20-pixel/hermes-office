<script setup lang="ts">
useHead({ title: 'Pengaturan' })
const { demo } = useOffice()
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">Pengaturan</h1>
      <BadgeDemo v-if="demo" ukuran="sm" />
    </div>
    <UCard>
      <Keadaan jenis="kosong" judul="Halaman belum tersedia" deskripsi="Pengaturan organisasi, anggota, dan kredensial runtime akan hadir pada iterasi berikutnya.">
        <template #aksi>
          <UButton to="/" variant="outline" color="neutral" size="sm" icon="i-lucide-layout-dashboard" label="Kembali ke Pusat Komando" />
        </template>
      </Keadaan>
    </UCard>
  </div>
</template>
