<script setup lang="ts">
/** Laci profil AI employee: identitas permanen, status run saat ini, daftar tugasnya. Tanpa aksi di mode demo. */
import type { KaryawanAI, TugasRingkas } from '~~/shared/kontrak'

const props = withDefaults(defineProps<{
  karyawan: KaryawanAI | null
  tugas?: TugasRingkas[]
  demo?: boolean
}>(), { tugas: () => [], demo: false })

const buka = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ bukaTugas: [taskId: string] }>()

const tugasKaryawan = computed(() => props.karyawan ? props.tugas.filter(t => t.employee?.id === props.karyawan?.id) : [])
const aktif = computed(() => tugasKaryawan.value.filter(t => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(t.status)))
const riwayat = computed(() => tugasKaryawan.value.filter(t => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(t.status)).slice(0, 10))
</script>

<template>
  <USlideover v-model:open="buka" :title="karyawan?.name ?? 'AI employee'" :description="karyawan ? `${karyawan.jobTitle} · ${karyawan.department}` : ''" :ui="{ content: 'max-w-lg' }">
    <template #body>
      <div v-if="karyawan" class="flex flex-col gap-5">
        <div class="flex items-center gap-2 flex-wrap">
          <UBadge :color="karyawan.isSupervisor ? 'primary' : 'neutral'" variant="outline" size="sm" :icon="karyawan.isSupervisor ? 'i-lucide-crown' : 'i-lucide-id-card'" :label="karyawan.isSupervisor ? 'Supervisor (MasterCEO)' : 'Karyawan tetap'" />
          <UBadge v-if="karyawan.runAktif > 0" color="info" variant="subtle" size="sm" icon="i-lucide-loader-circle" :label="`${karyawan.runAktif} run berjalan`" :ui="{ leadingIcon: 'animate-spin motion-reduce:animate-none' }" />
          <UBadge v-else color="neutral" variant="soft" size="sm" icon="i-lucide-circle-dashed" label="Idle" />
          <UBadge v-if="!karyawan.isActive" color="neutral" variant="soft" size="sm" icon="i-lucide-pause" label="Nonaktif" />
          <BadgeDemo v-if="demo" />
        </div>

        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div><dt class="text-xs text-muted">Spesialisasi</dt><dd class="font-medium text-highlighted">{{ karyawan.specialization ?? '—' }}</dd></div>
          <div><dt class="text-xs text-muted">Terakhir terlihat</dt><dd class="font-medium text-highlighted">{{ waktuLengkap(karyawan.terakhirTerlihat) }}</dd></div>
          <div><dt class="text-xs text-muted">Tugas aktif</dt><dd class="font-medium text-highlighted tnum">{{ aktif.length }}</dd></div>
          <div><dt class="text-xs text-muted">Riwayat (10 terakhir)</dt><dd class="font-medium text-highlighted tnum">{{ riwayat.length }}</dd></div>
        </dl>

        <p class="text-xs text-muted flex items-start gap-1.5 leading-relaxed">
          <UIcon name="i-lucide-info" class="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>Identitas ini permanen (peran, SOP, departemen). "Run" adalah eksekusi Hermes yang bersifat sementara dan hanya tampil bila ada di <code class="font-mono">agent_runs</code>.</span>
        </p>

        <section aria-label="Tugas aktif">
          <h3 class="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Tugas aktif</h3>
          <ul v-if="aktif.length" class="divide-y divide-default rounded-md ring-1 ring-default">
            <li v-for="t in aktif" :key="t.id">
              <button type="button" class="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-elevated/60 rounded-md" @click="emit('bukaTugas', t.id)">
                <span class="text-sm text-highlighted truncate">{{ t.title }}</span>
                <BadgeStatus :status="t.status" ukuran="xs" />
              </button>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">Tidak ada tugas aktif.</p>
        </section>

        <section aria-label="Riwayat tugas">
          <h3 class="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Riwayat</h3>
          <ul v-if="riwayat.length" class="divide-y divide-default rounded-md ring-1 ring-default">
            <li v-for="t in riwayat" :key="t.id">
              <button type="button" class="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-elevated/60 rounded-md" @click="emit('bukaTugas', t.id)">
                <span class="min-w-0">
                  <span class="text-sm text-highlighted truncate block">{{ t.title }}</span>
                  <span class="text-[11px] text-muted">{{ waktuRelatif(t.finishedAt ?? t.createdAt) }}</span>
                </span>
                <BadgeStatus :status="t.status" ukuran="xs" />
              </button>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">Belum ada riwayat.</p>
        </section>
      </div>
    </template>
  </USlideover>
</template>
