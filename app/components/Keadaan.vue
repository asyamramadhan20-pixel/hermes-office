<script setup lang="ts">
/** Keadaan non-data: memuat, kosong, basi, terputus, ditolak, gagal. Slot `aksi` opsional. */
type Jenis = 'memuat' | 'kosong' | 'basi' | 'terputus' | 'ditolak' | 'gagal'

const props = withDefaults(defineProps<{
  jenis: Jenis
  judul?: string
  deskripsi?: string
  padat?: boolean
}>(), { judul: '', deskripsi: '', padat: false })

const BAWAAN: Record<Jenis, { icon: string, judul: string, deskripsi: string, warna: string }> = {
  memuat: { icon: 'i-lucide-loader-circle', judul: 'Memuat data…', deskripsi: 'Mengambil data dari control plane.', warna: 'text-muted' },
  kosong: { icon: 'i-lucide-inbox', judul: 'Belum ada data', deskripsi: 'Belum ada yang bisa ditampilkan di sini.', warna: 'text-muted' },
  basi: { icon: 'i-lucide-clock-alert', judul: 'Data basi', deskripsi: 'Tidak ada event baru lebih dari 10 menit. Angka mungkin tertinggal.', warna: 'text-amber-600 dark:text-amber-400' },
  terputus: { icon: 'i-lucide-unplug', judul: 'Runtime terputus', deskripsi: 'Control plane tidak bisa menghubungi runtime Hermes.', warna: 'text-red-600 dark:text-red-400' },
  ditolak: { icon: 'i-lucide-lock', judul: 'Akses ditolak', deskripsi: 'Peran Anda tidak memiliki izin untuk bagian ini.', warna: 'text-muted' },
  gagal: { icon: 'i-lucide-triangle-alert', judul: 'Gagal memuat', deskripsi: 'Terjadi kesalahan saat mengambil data.', warna: 'text-red-600 dark:text-red-400' }
}
const b = computed(() => BAWAAN[props.jenis])
</script>

<template>
  <div
    :class="['flex flex-col items-center text-center gap-2', padat ? 'py-6 px-4' : 'py-12 px-6']"
    :role="jenis === 'memuat' ? 'status' : undefined"
    :aria-live="jenis === 'memuat' ? 'polite' : undefined"
  >
    <UIcon
      :name="b.icon"
      :class="['size-6', b.warna, jenis === 'memuat' ? 'animate-spin motion-reduce:animate-none' : '']"
      aria-hidden="true"
    />
    <p class="text-sm font-semibold text-highlighted">{{ judul || b.judul }}</p>
    <p class="text-xs text-muted max-w-sm leading-relaxed">{{ deskripsi || b.deskripsi }}</p>
    <div v-if="$slots.aksi" class="mt-2">
      <slot name="aksi" />
    </div>
  </div>
</template>
