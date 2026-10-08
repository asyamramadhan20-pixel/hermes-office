<script setup lang="ts">
/** Menggerakkan kamera + target OrbitControls secara halus ke ruangan yang difokuskan. Harus berada di dalam TresCanvas. */
import { useLoop } from '@tresjs/core'
import type { OrbitControls } from 'three-stdlib'
import type { Titik } from '~/utils/kantor3d'

const props = defineProps<{
  kontrol: OrbitControls | null
  fokus: { id: string, posisi: Titik, jarak: number } | null
  kameraAwal: Titik
  arahAwal: Titik
}>()

let animasiSampai = 0
let targetKamera: Titik = props.kameraAwal, targetArah: Titik = props.arahAwal
watch(() => props.fokus?.id, () => {
  const f = props.fokus
  if (f) { targetArah = [f.posisi[0], 0.3, f.posisi[2]]; targetKamera = [f.posisi[0], f.jarak * 0.85, f.posisi[2] + f.jarak] }
  else { targetArah = props.arahAwal; targetKamera = props.kameraAwal }
  animasiSampai = -1
})

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta, elapsed }) => {
  const c = props.kontrol
  if (!c) return
  if (animasiSampai < 0) animasiSampai = elapsed + 1.6
  if (elapsed > animasiSampai) return
  const k = 1 - Math.exp(-5 * delta)
  c.target.lerp({ x: targetArah[0], y: targetArah[1], z: targetArah[2] } as never, k)
  c.object.position.lerp({ x: targetKamera[0], y: targetKamera[1], z: targetKamera[2] } as never, k)
  c.update()
})
</script>

<template><TresGroup /></template>
