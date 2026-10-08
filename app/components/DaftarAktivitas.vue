<script setup lang="ts">
/** Aktivitas terbaru dari task_events. Hanya menampilkan apa yang ada di event; tidak ada narasi tambahan. */
import type { EventRingkas } from '~~/shared/kontrak'

const props = withDefaults(defineProps<{
  events: EventRingkas[]
  memuat?: boolean
  demo?: boolean
  maks?: number
  /** Peta taskId → judul (opsional, untuk konteks). */
  judulTugas?: Record<string, string>
}>(), { memuat: false, demo: false, maks: 10, judulTugas: () => ({}) })

const emit = defineEmits<{ pilih: [taskId: string] }>()

const IKON: Record<string, string> = {
  'session.started': 'i-lucide-play',
  'tool.completed': 'i-lucide-wrench',
  'tool.started': 'i-lucide-wrench',
  'subagent.started': 'i-lucide-git-branch',
  'subagent.finished': 'i-lucide-git-merge',
  'approval.requested': 'i-lucide-shield-question',
  'run.completed': 'i-lucide-circle-check',
  'run.failed': 'i-lucide-circle-x',
  'run.cancelled': 'i-lucide-ban',
  'poll.status': 'i-lucide-refresh-cw',
  'command.persisted': 'i-lucide-send'
}
const LABEL: Record<string, string> = {
  'session.started': 'Sesi dimulai',
  'tool.completed': 'Tool selesai',
  'tool.started': 'Tool dimulai',
  'subagent.started': 'Subagent dimulai',
  'subagent.finished': 'Subagent selesai',
  'approval.requested': 'Persetujuan diminta',
  'run.completed': 'Run selesai',
  'run.failed': 'Run gagal',
  'run.cancelled': 'Run dibatalkan',
  'poll.status': 'Poll status',
  'command.persisted': 'Perintah dicatat'
}
const SUMBER: Record<EventRingkas['source'], string> = { webhook: 'webhook', poll: 'poll', command: 'perintah', system: 'sistem' }

/** Ringkasan data yang aman: hanya nilai primitif pendek, maksimal 3 pasangan. */
function ringkasData(data: Record<string, unknown>): string[] {
  const hasil: string[] = []
  for (const [k, v] of Object.entries(data)) {
    if (hasil.length >= 3) break
    if (v === null || v === undefined) continue
    if (typeof v === 'object') continue
    let teks = String(v)
    if (k === 'durationMs' && typeof v === 'number') teks = v >= 60000 ? `${Math.round(v / 60000)} mnt` : `${(v / 1000).toFixed(1)} dtk`
    if (teks.length > 40) teks = `${teks.slice(0, 37)}…`
    hasil.push(`${k === 'durationMs' ? 'durasi' : k}: ${teks}`)
  }
  return hasil
}

const daftar = computed(() => props.events.slice(0, props.maks))
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-activity" class="size-4 text-muted" aria-hidden="true" />
          <h2 class="text-sm font-semibold text-highlighted">Aktivitas terbaru</h2>
        </div>
        <div class="flex items-center gap-2">
          <BadgeDemo v-if="demo" />
          <span class="text-xs text-muted">dari task_events</span>
        </div>
      </div>
    </template>

    <Keadaan v-if="memuat" jenis="memuat" padat />
    <Keadaan v-else-if="!daftar.length" jenis="kosong" judul="Belum ada aktivitas" deskripsi="Event akan muncul di sini begitu runtime mengirim webhook atau poll berjalan." padat />

    <ol v-else class="divide-y divide-default" aria-label="Daftar aktivitas terbaru">
      <li v-for="e in daftar" :key="e.id">
        <component
          :is="e.taskId ? 'button' : 'div'"
          :type="e.taskId ? 'button' : undefined"
          :class="['w-full text-left flex items-start gap-3 px-4 sm:px-5 py-3', e.taskId ? 'hover:bg-muted/60 focus-visible:bg-muted/60 transition-colors cursor-pointer' : '']"
          :aria-label="e.taskId ? `Buka tugas: ${judulTugas[e.taskId] ?? e.taskId}` : undefined"
          @click="e.taskId && emit('pilih', e.taskId)"
        >
          <span class="mt-0.5 size-7 rounded-md bg-muted flex items-center justify-center shrink-0">
            <UIcon :name="IKON[e.sourceEventType] ?? 'i-lucide-dot'" class="size-3.5 text-toned" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium text-highlighted truncate">{{ LABEL[e.sourceEventType] ?? e.sourceEventType }}</span>
              <time :datetime="e.occurredAt" :title="waktuLengkap(e.occurredAt)" class="text-xs text-muted shrink-0 tnum">{{ waktuRelatif(e.occurredAt) }}</time>
            </span>
            <span class="block text-xs text-muted truncate mt-0.5">
              <span class="font-mono">{{ e.sourceEventType }}</span>
              <span aria-hidden="true"> · </span>{{ SUMBER[e.source] }}
              <template v-if="e.taskId && judulTugas[e.taskId]"><span aria-hidden="true"> · </span>{{ judulTugas[e.taskId] }}</template>
            </span>
            <span v-if="ringkasData(e.data).length" class="flex flex-wrap gap-1 mt-1.5">
              <span v-for="(d, i) in ringkasData(e.data)" :key="i" class="text-[11px] font-mono text-toned bg-muted rounded px-1.5 py-0.5">{{ d }}</span>
            </span>
          </span>
        </component>
      </li>
    </ol>
  </UCard>
</template>
