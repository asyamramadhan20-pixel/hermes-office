<script setup lang="ts">
/** Ubin statistik: ikon + label + angka. `belumTersambung` = sumber data belum ada (tidak menampilkan angka contoh). */
withDefaults(defineProps<{
  label: string
  nilai?: number | null
  icon: string
  keterangan?: string
  belumTersambung?: boolean
  demo?: boolean
  memuat?: boolean
  /** Warna ikon; 'info' = cyan untuk aktivitas berjalan. */
  nada?: 'neutral' | 'info' | 'success' | 'warning' | 'error'
}>(), { nilai: null, keterangan: '', belumTersambung: false, demo: false, memuat: false, nada: 'neutral' })

const warnaIkon: Record<string, string> = {
  neutral: 'text-muted',
  info: 'text-cyan-600 dark:text-cyan-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400'
}
</script>

<template>
  <div class="bg-default ring-1 ring-default rounded-lg p-4 sm:p-5 flex flex-col gap-3 min-w-0" role="group" :aria-label="label">
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <UIcon :name="icon" :class="['size-4 shrink-0', warnaIkon[nada]]" aria-hidden="true" />
        <span class="text-sm font-medium text-muted truncate">{{ label }}</span>
      </div>
      <BadgeDemo v-if="demo" />
    </div>

    <template v-if="belumTersambung">
      <div class="flex items-center gap-2 text-highlighted">
        <UIcon name="i-lucide-plug" class="size-4 text-muted" aria-hidden="true" />
        <span class="text-base font-semibold">Belum tersambung</span>
      </div>
      <p v-if="keterangan" class="text-xs text-muted leading-relaxed">{{ keterangan }}</p>
    </template>
    <template v-else>
      <USkeleton v-if="memuat" class="h-9 w-16" />
      <p v-else class="text-3xl font-semibold tracking-tight text-highlighted tnum leading-none">
        {{ nilai === null || nilai === undefined ? '—' : angkaId(nilai) }}
      </p>
      <p v-if="keterangan" class="text-xs text-muted">{{ keterangan }}</p>
    </template>
  </div>
</template>
