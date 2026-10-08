<script setup lang="ts">
/** Penanda data simulasi. Wajib tampil di setiap kartu pada mode demo. */
withDefaults(defineProps<{ ukuran?: 'xs' | 'sm' }>(), { ukuran: 'xs' })
</script>

<template>
  <UBadge
    color="warning"
    variant="subtle"
    :size="ukuran"
    icon="i-lucide-flask-conical"
    label="DEMO"
    class="font-semibold tracking-wide"
    aria-label="Data demo (simulasi), bukan eksekusi sungguhan"
    title="Data demo (simulasi), bukan eksekusi sungguhan"
  />
</template>
