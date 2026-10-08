<script setup lang="ts">
/**
 * Kesehatan runtime Hermes. Keadaan turunan:
 * - belum dipasang  : !terpasang
 * - terputus        : status === 'offline'
 * - basi            : menitSejakEventTerakhir > 10
 */
import type { RuntimeRingkas } from '~~/shared/kontrak'

const props = defineProps<{ runtime: RuntimeRingkas | null, demo?: boolean, memuat?: boolean }>()

const keadaan = computed<'memuat' | 'belum' | 'terputus' | 'basi' | 'sehat' | 'tidakDiketahui'>(() => {
  if (props.memuat || !props.runtime) return 'memuat'
  if (!props.runtime.terpasang) return 'belum'
  if (props.runtime.status === 'offline') return 'terputus'
  if ((props.runtime.menitSejakEventTerakhir ?? Infinity) > 10) return 'basi'
  if (props.runtime.status === 'unknown') return 'tidakDiketahui'
  return 'sehat'
})

const LABEL_FITUR: Record<string, string> = {
  run_submission: 'Kirim run',
  run_status: 'Status run',
  run_events_sse: 'Event SSE',
  run_stop: 'Hentikan run',
  run_approval: 'Persetujuan'
}
const fitur = computed(() => Object.entries(props.runtime?.fitur ?? {}).map(([k, v]) => ({ kunci: k, label: LABEL_FITUR[k] ?? k, aktif: v })))
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <UIcon name="i-lucide-server" class="size-4 text-muted shrink-0" aria-hidden="true" />
          <h2 class="text-sm font-semibold text-highlighted truncate">Kesehatan runtime</h2>
        </div>
        <div class="flex items-center gap-2">
          <BadgeDemo v-if="demo" />
          <BadgeStatus v-if="runtime?.terpasang" jenis="runtime" :status="runtime.status" />
        </div>
      </div>
    </template>

    <Keadaan v-if="keadaan === 'memuat'" jenis="memuat" padat />

    <Keadaan
      v-else-if="keadaan === 'belum'"
      jenis="kosong"
      judul="Runtime belum dipasang"
      deskripsi="Organisasi ini belum memiliki runtime Hermes. Pasang runtime di Pengaturan untuk mulai menjalankan AI employee."
      padat
    >
      <template #aksi>
        <UButton to="/pengaturan" variant="outline" color="neutral" size="sm" icon="i-lucide-settings" label="Buka Pengaturan" />
      </template>
    </Keadaan>

    <div v-else class="flex flex-col gap-4">
      <Keadaan v-if="keadaan === 'terputus'" jenis="terputus" :deskripsi="runtime?.lastError || undefined" padat />
      <Keadaan
        v-else-if="keadaan === 'basi'"
        jenis="basi"
        :deskripsi="`Event terakhir ${runtime?.menitSejakEventTerakhir} menit lalu. Status mungkin tidak mencerminkan keadaan sebenarnya.`"
        padat
      />
      <Keadaan
        v-else-if="keadaan === 'tidakDiketahui'"
        jenis="gagal"
        judul="Status runtime tidak diketahui"
        deskripsi="Runtime belum pernah melaporkan status. Menunggu poll berikutnya."
        padat
      />

      <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div class="min-w-0">
          <dt class="text-xs text-muted">Nama runtime</dt>
          <dd class="font-medium text-highlighted truncate font-mono text-[13px]">{{ runtime?.name ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">Versi Hermes</dt>
          <dd class="font-medium text-highlighted tnum">{{ runtime?.hermesVersion ?? 'belum terdeteksi' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">Terakhir terlihat</dt>
          <dd class="font-medium text-highlighted" :title="waktuLengkap(runtime?.lastSeenAt)">{{ waktuRelatif(runtime?.lastSeenAt) }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">Event terakhir</dt>
          <dd class="font-medium text-highlighted tnum">
            {{ runtime?.menitSejakEventTerakhir === null || runtime?.menitSejakEventTerakhir === undefined ? 'belum ada' : `${runtime.menitSejakEventTerakhir} menit lalu` }}
          </dd>
        </div>
      </dl>

      <div>
        <p class="text-xs text-muted mb-2">Fitur terdeteksi <span class="text-dimmed">(GET /v1/capabilities)</span></p>
        <ul v-if="fitur.length" class="flex flex-wrap gap-1.5" aria-label="Fitur runtime">
          <li v-for="f in fitur" :key="f.kunci">
            <UBadge
              :color="f.aktif ? 'neutral' : 'warning'"
              variant="outline"
              size="sm"
              :icon="f.aktif ? 'i-lucide-check' : 'i-lucide-minus'"
              :label="f.label"
              :title="`${f.kunci}: ${f.aktif ? 'didukung' : 'tidak didukung'}`"
            />
          </li>
        </ul>
        <p v-else class="text-xs text-muted italic">Belum pernah terdeteksi.</p>
      </div>

      <p v-if="runtime?.lastError && keadaan !== 'terputus'" class="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
        <UIcon name="i-lucide-triangle-alert" class="size-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        <span>{{ runtime.lastError }}</span>
      </p>
    </div>
  </UCard>
</template>
