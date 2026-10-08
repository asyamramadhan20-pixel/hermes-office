<script setup lang="ts">
/**
 * Baris roster AI employee. Identitas permanen (karyawan tetap / supervisor) dibedakan dari
 * run yang bersifat sementara (chip cyan "n run berjalan").
 */
import type { KaryawanAI } from '~~/shared/kontrak'

const props = defineProps<{ karyawan: KaryawanAI }>()
const emit = defineEmits<{ pilihTugas: [taskId: string] }>()

const inisial = computed(() => props.karyawan.name.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase())
const sibuk = computed(() => props.karyawan.runAktif > 0)
</script>

<template>
  <div class="flex items-start gap-3 px-4 sm:px-5 py-3">
    <span
      :class="['size-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
               karyawan.isSupervisor ? 'bg-primary/10 text-primary' : 'bg-muted text-toned']"
      aria-hidden="true"
    >{{ inisial }}</span>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm font-semibold text-highlighted">{{ karyawan.name }}</span>
        <UBadge
          :color="karyawan.isSupervisor ? 'primary' : 'neutral'"
          variant="outline"
          size="xs"
          :icon="karyawan.isSupervisor ? 'i-lucide-crown' : 'i-lucide-id-card'"
          :label="karyawan.isSupervisor ? 'Supervisor' : 'Karyawan tetap'"
        />
        <UBadge v-if="!karyawan.isActive" color="neutral" variant="soft" size="xs" icon="i-lucide-pause" label="Nonaktif" />
      </div>
      <p class="text-xs text-muted truncate mt-0.5">{{ karyawan.jobTitle }} · {{ karyawan.department }}</p>
      <button
        v-if="karyawan.tugasAktif"
        type="button"
        class="mt-1.5 text-xs text-toned hover:text-highlighted text-left truncate max-w-full flex items-center gap-1 rounded"
        :aria-label="`Buka tugas aktif: ${karyawan.tugasAktif.title}`"
        @click="emit('pilihTugas', karyawan.tugasAktif.id)"
      >
        <UIcon name="i-lucide-corner-down-right" class="size-3 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ karyawan.tugasAktif.title }}</span>
      </button>
    </div>

    <div class="flex flex-col items-end gap-1 shrink-0">
      <UBadge
        v-if="sibuk"
        color="info"
        variant="subtle"
        size="xs"
        icon="i-lucide-loader-circle"
        :label="`${karyawan.runAktif} run berjalan`"
        :ui="{ leadingIcon: 'animate-spin motion-reduce:animate-none' }"
        title="Run bersifat sementara; hilang saat selesai"
      />
      <UBadge v-else color="neutral" variant="soft" size="xs" icon="i-lucide-circle-dashed" label="Idle" />
      <span class="text-[11px] text-muted tnum" :title="waktuLengkap(karyawan.terakhirTerlihat)">{{ waktuRelatif(karyawan.terakhirTerlihat) }}</span>
    </div>
  </div>
</template>
