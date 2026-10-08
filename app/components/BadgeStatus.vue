<script setup lang="ts">
/**
 * Badge status tugas / run / runtime: SELALU ikon + label teks (bukan warna saja).
 * Cyan (info) hanya untuk "berjalan".
 */
import type { StatusTugas, StatusRun, StatusRuntime } from '~~/shared/status'
import { LABEL_STATUS_TUGAS } from '~~/shared/status'

type Warna = 'neutral' | 'info' | 'success' | 'warning' | 'error'
interface Tampilan { icon: string, label: string, color: Warna, aktif?: boolean }

const props = withDefaults(defineProps<{
  jenis?: 'tugas' | 'run' | 'runtime'
  status: StatusTugas | StatusRun | StatusRuntime
  ukuran?: 'xs' | 'sm' | 'md'
}>(), { jenis: 'tugas', ukuran: 'sm' })

const TUGAS: Record<StatusTugas, Omit<Tampilan, 'label'>> = {
  CREATED: { icon: 'i-lucide-file-plus', color: 'neutral' },
  QUEUED: { icon: 'i-lucide-list-ordered', color: 'neutral' },
  ASSIGNED: { icon: 'i-lucide-user-check', color: 'neutral' },
  RUNNING: { icon: 'i-lucide-loader-circle', color: 'info', aktif: true },
  WAITING_APPROVAL: { icon: 'i-lucide-shield-question', color: 'warning' },
  BLOCKED: { icon: 'i-lucide-octagon-alert', color: 'warning' },
  COMPLETED: { icon: 'i-lucide-circle-check', color: 'success' },
  FAILED: { icon: 'i-lucide-circle-x', color: 'error' },
  CANCEL_REQUESTED: { icon: 'i-lucide-hand', color: 'warning' },
  CANCELLED: { icon: 'i-lucide-ban', color: 'neutral' },
  UNKNOWN: { icon: 'i-lucide-circle-help', color: 'warning' }
}

const RUN: Record<StatusRun, Tampilan> = {
  queued: { icon: 'i-lucide-list-ordered', label: 'Antre', color: 'neutral' },
  running: { icon: 'i-lucide-loader-circle', label: 'Berjalan', color: 'info', aktif: true },
  waiting_for_approval: { icon: 'i-lucide-shield-question', label: 'Menunggu persetujuan', color: 'warning' },
  stopping: { icon: 'i-lucide-hand', label: 'Menghentikan', color: 'warning' },
  completed: { icon: 'i-lucide-circle-check', label: 'Selesai', color: 'success' },
  failed: { icon: 'i-lucide-circle-x', label: 'Gagal', color: 'error' },
  cancelled: { icon: 'i-lucide-ban', label: 'Dibatalkan', color: 'neutral' },
  interrupted: { icon: 'i-lucide-zap-off', label: 'Terputus', color: 'warning' },
  unknown: { icon: 'i-lucide-circle-help', label: 'Tidak diketahui', color: 'warning' }
}

const RUNTIME: Record<StatusRuntime, Tampilan> = {
  online: { icon: 'i-lucide-radio', label: 'Online', color: 'success' },
  offline: { icon: 'i-lucide-unplug', label: 'Terputus', color: 'error' },
  unknown: { icon: 'i-lucide-circle-help', label: 'Tidak diketahui', color: 'warning' }
}

const tampil = computed<Tampilan>(() => {
  if (props.jenis === 'run') return RUN[props.status as StatusRun] ?? RUN.unknown
  if (props.jenis === 'runtime') return RUNTIME[props.status as StatusRuntime] ?? RUNTIME.unknown
  const s = props.status as StatusTugas
  const t = TUGAS[s] ?? TUGAS.UNKNOWN
  return { ...t, label: LABEL_STATUS_TUGAS[s] ?? LABEL_STATUS_TUGAS.UNKNOWN }
})
</script>

<template>
  <UBadge
    :color="tampil.color"
    variant="subtle"
    :size="ukuran"
    :icon="tampil.icon"
    :label="tampil.label"
    :ui="{ leadingIcon: tampil.aktif ? 'animate-spin motion-reduce:animate-none' : '' }"
    class="whitespace-nowrap"
  />
</template>
