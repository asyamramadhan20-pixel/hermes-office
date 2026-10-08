<script setup lang="ts">
/**
 * Komposer perintah (ASSIGN_TASK). Dirender HANYA jika `bolehAksi` (mode live + peran berhak);
 * induk bertanggung jawab tidak merender komponen ini di mode demo.
 */
import type { KaryawanAI, BuatPerintah } from '~~/shared/kontrak'

const props = withDefaults(defineProps<{ karyawan: KaryawanAI[], mengirim?: boolean }>(), { mengirim: false })
const emit = defineEmits<{ kirim: [payload: BuatPerintah] }>()

const PRIORITAS = [
  { label: 'Tinggi (1)', value: 1 },
  { label: 'Normal (2)', value: 2 },
  { label: 'Rendah (3)', value: 3 }
]

const judul = ref('')
const tujuan = ref('')
const employeeId = ref<string | undefined>(undefined)
const prioritas = ref(2)

const pilihanKaryawan = computed(() => props.karyawan
  .filter(k => k.isActive)
  .map(k => ({ label: k.isSupervisor ? `${k.name} · Supervisor` : `${k.name} · ${k.jobTitle}`, value: k.id })))

const sah = computed(() => judul.value.trim().length >= 3 && tujuan.value.trim().length >= 10 && !!employeeId.value)

function kirim() {
  if (!sah.value || !employeeId.value) return
  emit('kirim', {
    type: 'ASSIGN_TASK',
    employeeId: employeeId.value,
    title: judul.value.trim(),
    objective: tujuan.value.trim(),
    priority: prioritas.value
  })
}

function reset() {
  judul.value = ''
  tujuan.value = ''
  prioritas.value = 2
}
defineExpose({ reset })
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-send" class="size-4 text-muted" aria-hidden="true" />
        <h2 class="text-sm font-semibold text-highlighted">Kirim perintah</h2>
      </div>
    </template>

    <form class="flex flex-col gap-4" aria-label="Formulir kirim perintah" @submit.prevent="kirim">
      <UFormField label="Judul tugas" name="judul" required>
        <UInput v-model="judul" placeholder="Mis. Rekap omset harian" class="w-full" maxlength="120" />
      </UFormField>
      <UFormField label="Tujuan / instruksi" name="tujuan" required hint="Minimal 10 karakter">
        <UTextarea v-model="tujuan" :rows="4" autoresize placeholder="Jelaskan hasil yang diharapkan, sumber data, dan batasan." class="w-full" />
      </UFormField>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField label="AI employee" name="employee" required>
          <USelectMenu
            v-model="employeeId"
            :items="pilihanKaryawan"
            value-key="value"
            placeholder="Pilih karyawan"
            class="w-full"
            :search-input="{ placeholder: 'Cari karyawan…' }"
          />
        </UFormField>
        <UFormField label="Prioritas" name="prioritas">
          <USelect v-model="prioritas" :items="PRIORITAS" value-key="value" class="w-full" />
        </UFormField>
      </div>
      <div class="flex items-center justify-between gap-3 pt-1">
        <p class="text-xs text-muted">Perintah dicatat dulu di control plane, lalu diteruskan ke runtime.</p>
        <UButton type="submit" icon="i-lucide-send" label="Kirim" :disabled="!sah" :loading="mengirim" />
      </div>
    </form>
  </UCard>
</template>
