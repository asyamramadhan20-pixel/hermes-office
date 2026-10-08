<script setup lang="ts">
/** Laci detail tugas (USlideover). Tidak merender aksi apa pun di mode demo. */
import type { TugasRingkas, EventRingkas } from '~~/shared/kontrak'

const props = withDefaults(defineProps<{
  tugas: TugasRingkas | null
  events?: EventRingkas[]
  demo?: boolean
  bolehAksi?: boolean
}>(), { events: () => [], demo: false, bolehAksi: false })

const buka = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ batalkan: [taskId: string] }>()

const eventTugas = computed(() => props.tugas ? props.events.filter(e => e.taskId === props.tugas?.id) : [])
const bisaDibatalkan = computed(() => !!props.tugas && ['QUEUED', 'ASSIGNED', 'RUNNING', 'WAITING_APPROVAL', 'BLOCKED', 'CREATED'].includes(props.tugas.status))
const LABEL_PRIORITAS: Record<number, string> = { 1: 'Tinggi', 2: 'Normal', 3: 'Rendah' }
</script>

<template>
  <USlideover v-model:open="buka" :title="tugas?.title ?? 'Detail tugas'" description="Detail tugas dan riwayat event" :ui="{ content: 'max-w-lg' }">
    <template #body>
      <div v-if="tugas" class="flex flex-col gap-5">
        <div class="flex items-center gap-2 flex-wrap">
          <BadgeStatus :status="tugas.status" />
          <BadgeStatus v-if="tugas.runUtama" jenis="run" :status="tugas.runUtama.status" />
          <BadgeDemo v-if="demo" />
        </div>

        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt class="text-xs text-muted">AI employee</dt>
            <dd class="font-medium text-highlighted">{{ tugas.employee?.name ?? 'Belum ditugaskan' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">Prioritas</dt>
            <dd class="font-medium text-highlighted">{{ LABEL_PRIORITAS[tugas.priority] ?? tugas.priority }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">Dibuat</dt>
            <dd class="font-medium text-highlighted">{{ waktuLengkap(tugas.createdAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">Mulai</dt>
            <dd class="font-medium text-highlighted">{{ waktuLengkap(tugas.startedAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">Selesai</dt>
            <dd class="font-medium text-highlighted">{{ waktuLengkap(tugas.finishedAt) }}</dd>
          </div>
          <div class="min-w-0">
            <dt class="text-xs text-muted">Run Hermes</dt>
            <dd class="font-mono text-[13px] text-highlighted truncate">{{ tugas.runUtama?.hermesRunId ?? '—' }}</dd>
          </div>
        </dl>

        <section v-if="tugas.outputSummary" aria-label="Ringkasan hasil">
          <h3 class="text-xs text-muted mb-1">Ringkasan hasil</h3>
          <p class="text-sm text-highlighted leading-relaxed bg-muted rounded-md p-3">{{ tugas.outputSummary }}</p>
        </section>

        <UAlert
          v-if="tugas.lastError"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Kesalahan terakhir"
          :description="tugas.lastError"
        />

        <UAlert
          v-if="tugas.status === 'UNKNOWN'"
          color="warning"
          variant="subtle"
          icon="i-lucide-circle-help"
          title="Status tidak diketahui"
          description="Runtime tidak melaporkan status. Runtime diam bukan berarti selesai; control plane akan merekonsiliasi lewat poll."
        />

        <section aria-label="Riwayat event">
          <h3 class="text-xs text-muted mb-2">Riwayat event ({{ eventTugas.length }})</h3>
          <ol v-if="eventTugas.length" class="flex flex-col gap-2">
            <li v-for="e in eventTugas" :key="e.id" class="flex items-center justify-between gap-3 text-sm">
              <span class="font-mono text-[13px] text-highlighted truncate">{{ e.sourceEventType }}</span>
              <time :datetime="e.occurredAt" class="text-xs text-muted shrink-0 tnum">{{ waktuLengkap(e.occurredAt) }}</time>
            </li>
          </ol>
          <p v-else class="text-xs text-muted italic">Belum ada event untuk tugas ini.</p>
        </section>
      </div>
      <Keadaan v-else jenis="kosong" judul="Tidak ada tugas dipilih" padat />
    </template>

    <template v-if="tugas" #footer>
      <div class="flex items-center justify-between gap-3 w-full">
        <p v-if="demo" class="text-xs text-muted">Mode demo: aksi dinonaktifkan.</p>
        <p v-else-if="!bolehAksi" class="text-xs text-muted">Peran Anda tidak dapat mengubah tugas.</p>
        <span v-else />
        <UButton
          v-if="bolehAksi && !demo && bisaDibatalkan"
          color="error"
          variant="outline"
          icon="i-lucide-hand"
          label="Minta pembatalan"
          @click="emit('batalkan', tugas.id)"
        />
      </div>
    </template>
  </USlideover>
</template>
