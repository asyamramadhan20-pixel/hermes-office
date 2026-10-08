<script setup lang="ts">
/**
 * Karakter low-poly satu AI employee. Bergerak (bob halus) HANYA bila runAktif > 0 — sumbernya agent_runs.
 * Nonaktif: abu-abu & redup. Klik → pilih (laci profil). Label HTML: nama + status (ikon + teks).
 */
import { shallowRef } from 'vue'
import type { Group } from 'three'
import { useLoop } from '@tresjs/core'
import { Html } from '@tresjs/cientos'
import type { KaryawanAI } from '~~/shared/kontrak'
import { WARNA_AKTIF } from '~/utils/kantor3d'

const props = withDefaults(defineProps<{
  karyawan: KaryawanAI
  position?: [number, number, number]
  warna: string
  gelap?: boolean
  terpilih?: boolean
}>(), { position: () => [0, 0, 0], gelap: false, terpilih: false })
const emit = defineEmits<{ pilih: [karyawan: KaryawanAI] }>()

const grup = shallowRef<Group | null>(null)
const sibuk = computed(() => props.karyawan.runAktif > 0 && props.karyawan.isActive)
const hover = ref(false)

const warnaBadan = computed(() => props.karyawan.isActive ? props.warna : (props.gelap ? '#4C5567' : '#B4BBC7'))
const warnaKulit = computed(() => props.karyawan.isActive ? '#F2C9A8' : (props.gelap ? '#6B7384' : '#D5DAE1'))
const fase = Math.random() * Math.PI * 2 // hanya menggeser fase bob, bukan "aktivitas"

const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => {
  const g = grup.value
  if (!g) return
  // Gerak hanya untuk yang benar-benar punya run berjalan; sisanya diam.
  g.position.y = sibuk.value ? Math.sin(elapsed * 2.2 + fase) * 0.03 : 0
})

function pilih() { emit('pilih', props.karyawan) }
function masuk() { hover.value = true; document.body.style.cursor = 'pointer' }
function keluar() { hover.value = false; document.body.style.cursor = '' }
</script>

<template>
  <TresGroup :position="position">
    <!-- cincin pilihan / hover -->
    <TresMesh v-if="terpilih || hover" :position="[0, 0.02, 0]" :rotation="[-Math.PI / 2, 0, 0]">
      <TresRingGeometry :args="[0.34, 0.42, 32]" />
      <TresMeshBasicMaterial :color="terpilih ? '#8C83F5' : '#A099F6'" :transparent="true" :opacity="0.9" />
    </TresMesh>
    <!-- cincin aktivitas (cyan) hanya bila run berjalan -->
    <TresMesh v-if="sibuk" :position="[0, 0.015, 0]" :rotation="[-Math.PI / 2, 0, 0]">
      <TresRingGeometry :args="[0.44, 0.5, 32]" />
      <TresMeshBasicMaterial :color="WARNA_AKTIF" :transparent="true" :opacity="0.6" />
    </TresMesh>

    <TresGroup ref="grup" @click.stop="pilih" @pointer-enter="masuk" @pointer-leave="keluar">
      <!-- kaki -->
      <TresMesh v-for="(x, i) in [-0.09, 0.09]" :key="i" :position="[x, 0.16, 0]" cast-shadow>
        <TresCylinderGeometry :args="[0.06, 0.06, 0.32, 10]" />
        <TresMeshStandardMaterial :color="gelap ? '#2A303C' : '#3A4150'" />
      </TresMesh>
      <!-- badan -->
      <TresMesh :position="[0, 0.56, 0]" cast-shadow>
        <TresCapsuleGeometry :args="[0.18, 0.34, 6, 12]" />
        <TresMeshStandardMaterial :color="warnaBadan" :roughness="0.6" />
      </TresMesh>
      <!-- lengan -->
      <TresMesh v-for="(x, i) in [-0.25, 0.25]" :key="`l${i}`" :position="[x, 0.56, 0]" :rotation="[0, 0, x < 0 ? 0.25 : -0.25]" cast-shadow>
        <TresCapsuleGeometry :args="[0.055, 0.26, 4, 8]" />
        <TresMeshStandardMaterial :color="warnaBadan" :roughness="0.6" />
      </TresMesh>
      <!-- kepala -->
      <TresMesh :position="[0, 0.98, 0]" cast-shadow>
        <TresSphereGeometry :args="[0.19, 18, 14]" />
        <TresMeshStandardMaterial :color="warnaKulit" :roughness="0.7" />
      </TresMesh>
      <!-- rambut / topi supervisor -->
      <TresMesh v-if="karyawan.isSupervisor" :position="[0, 1.17, 0]" cast-shadow>
        <TresCylinderGeometry :args="[0.14, 0.2, 0.1, 6]" />
        <TresMeshStandardMaterial color="#F2B32B" :metalness="0.4" :roughness="0.4" />
      </TresMesh>
      <TresMesh v-else :position="[0, 1.09, -0.02]" cast-shadow>
        <TresSphereGeometry :args="[0.185, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]" />
        <TresMeshStandardMaterial :color="gelap ? '#1B1F29' : '#2A2F3A'" :roughness="0.9" />
      </TresMesh>
    </TresGroup>

    <Html :position="[0, 1.62, 0]" center :occlude="false" wrapper-class="pointer-events-none select-none">
      <div class="flex flex-col items-center gap-0.5 whitespace-nowrap -translate-y-1">
        <span :class="['text-[11px] font-semibold px-1.5 py-0.5 rounded-md ring-1 ring-default bg-default/90 text-highlighted backdrop-blur-sm', !karyawan.isActive ? 'opacity-60' : '']">{{ karyawan.name }}</span>
        <span
          v-if="sibuk"
          class="text-[10px] px-1.5 py-px rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500/40 flex items-center gap-1"
        ><span class="size-1.5 rounded-full bg-cyan-500 animate-pulse motion-reduce:animate-none" aria-hidden="true" />{{ karyawan.runAktif }} run</span>
        <span v-else-if="!karyawan.isActive" class="text-[10px] px-1.5 py-px rounded-full bg-muted text-muted ring-1 ring-default">nonaktif</span>
        <span v-else class="text-[10px] px-1.5 py-px rounded-full bg-muted text-muted ring-1 ring-default">idle</span>
      </div>
    </Html>
  </TresGroup>
</template>
