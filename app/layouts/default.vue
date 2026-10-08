<script setup lang="ts">
import type { NavigationMenuItem, DropdownMenuItem } from '@nuxt/ui'

const config = useRuntimeConfig()
const colorMode = useColorMode()
const route = useRoute()
const { demo, orgAktif, profil } = useOffice()
const { data: profilSaya } = profil()

const navBuka = ref(false)
watch(() => route.path, () => { navBuka.value = false })

const NAV: NavigationMenuItem[] = [
  { label: 'Pusat Komando', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Kantor Virtual', icon: 'i-lucide-building-2', to: '/kantor' },
  { label: 'Papan Tugas', icon: 'i-lucide-kanban', to: '/tugas' },
  { label: 'Persetujuan', icon: 'i-lucide-shield-check', to: '/persetujuan' },
  { label: 'Kesehatan Runtime', icon: 'i-lucide-heart-pulse', to: '/runtime' },
  { label: 'Pengaturan', icon: 'i-lucide-settings', to: '/pengaturan' }
]

const pilihanOrg = computed(() => (profilSaya.value?.organizations ?? []).map(o => ({ label: o.name, value: o.id, role: o.role })))
/** Proksi: USelectMenu memakai `string | undefined`, state memakai `string | null`. */
const orgTerpilih = computed<string | undefined>({
  get: () => orgAktif.value ?? undefined,
  set: v => { orgAktif.value = v ?? null }
})

const gelap = computed(() => colorMode.value === 'dark')
function toggleMode() { colorMode.preference = gelap.value ? 'light' : 'dark' }

async function keluar() {
  if (demo) { await navigateTo('/login'); return }
  try { await $fetch('/api/auth/logout', { method: 'POST' }) } catch { /* tetap arahkan ke login */ }
  const { clear } = useUserSession()
  await clear()
  await navigateTo('/login')
}

const menuPengguna = computed<DropdownMenuItem[][]>(() => [
  [{ label: profilSaya.value?.user.name ?? 'Pengguna', description: profilSaya.value?.user.email, type: 'label' }],
  [{ label: 'Pengaturan', icon: 'i-lucide-settings', to: '/pengaturan' }],
  [{ label: 'Keluar', icon: 'i-lucide-log-out', onSelect: () => { void keluar() } }]
])

const inisialPengguna = computed(() => (profilSaya.value?.user.name ?? 'P').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase())
</script>

<template>
  <div class="min-h-dvh bg-shell flex">
    <!-- Sidebar desktop -->
    <aside class="hidden lg:flex lg:flex-col w-64 shrink-0 border-r border-default bg-default sticky top-0 h-dvh" aria-label="Navigasi utama">
      <div class="h-16 flex items-center gap-2.5 px-5 border-b border-default">
        <span class="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center" aria-hidden="true">
          <UIcon name="i-lucide-hexagon" class="size-4" />
        </span>
        <div class="min-w-0 leading-tight">
          <p class="text-sm font-semibold text-highlighted truncate">{{ config.public.appName }}</p>
          <p class="text-[11px] text-muted">Control plane</p>
        </div>
      </div>
      <nav class="flex-1 overflow-y-auto px-3 py-4">
        <UNavigationMenu orientation="vertical" :items="NAV" highlight :ui="{ link: 'py-2' }" />
      </nav>
      <div class="px-5 py-4 border-t border-default text-[11px] text-muted leading-relaxed">
        <p class="font-medium text-toned">Mode: {{ demo ? 'Demo' : 'Live' }}</p>
        <p>Data berasal dari task_events; tidak ada aktivitas agent yang disimulasikan.</p>
      </div>
    </aside>

    <!-- Nav mobile -->
    <USlideover v-model:open="navBuka" side="left" title="Navigasi" :ui="{ content: 'max-w-xs' }">
      <template #body>
        <UNavigationMenu orientation="vertical" :items="NAV" highlight />
      </template>
    </USlideover>

    <div class="flex-1 min-w-0 flex flex-col">
      <!-- Top bar -->
      <header class="sticky top-0 z-20 h-16 bg-default/95 backdrop-blur border-b border-default">
        <div class="h-full flex items-center gap-3 px-4 sm:px-6">
          <UButton class="lg:hidden" variant="ghost" color="neutral" icon="i-lucide-menu" aria-label="Buka navigasi" @click="navBuka = true" />
          <p class="lg:hidden text-sm font-semibold text-highlighted truncate">{{ config.public.appName }}</p>

          <div class="flex-1" />

          <USelectMenu
            v-model="orgTerpilih"
            :items="pilihanOrg"
            value-key="value"
            :search-input="false"
            icon="i-lucide-building-2"
            placeholder="Pilih organisasi"
            aria-label="Organisasi aktif"
            class="w-44 sm:w-56"
            :ui="{ base: 'text-sm' }"
          />

          <ClientOnly>
            <UButton
              variant="ghost"
              color="neutral"
              :icon="gelap ? 'i-lucide-sun' : 'i-lucide-moon'"
              :aria-label="gelap ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'"
              @click="toggleMode"
            />
            <template #fallback>
              <UButton variant="ghost" color="neutral" icon="i-lucide-moon" aria-label="Ganti mode warna" />
            </template>
          </ClientOnly>

          <UDropdownMenu :items="menuPengguna" :ui="{ content: 'w-56' }">
            <UButton variant="ghost" color="neutral" aria-label="Menu pengguna" class="pl-1">
              <span class="size-7 rounded-full bg-muted text-toned text-xs font-semibold flex items-center justify-center" aria-hidden="true">{{ inisialPengguna }}</span>
              <UIcon name="i-lucide-chevron-down" class="size-3.5 text-muted" aria-hidden="true" />
            </UButton>
          </UDropdownMenu>
        </div>

        <!-- Banner DEMO global -->
        <div
          v-if="demo"
          role="status"
          class="flex items-center gap-2 px-4 sm:px-6 py-1.5 text-xs font-medium bg-amber-50 text-amber-900 border-b border-amber-200 dark:bg-amber-400/10 dark:text-amber-200 dark:border-amber-400/20"
        >
          <UIcon name="i-lucide-flask-conical" class="size-3.5 shrink-0" aria-hidden="true" />
          <span><strong class="font-semibold">MODE DEMO.</strong> Semua data adalah fixture simulasi, bukan eksekusi sungguhan. Aksi kontrol tidak tersedia.</span>
        </div>
      </header>

      <main id="konten" class="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] w-full mx-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
