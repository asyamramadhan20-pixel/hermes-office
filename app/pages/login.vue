<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'Masuk' })

const config = useRuntimeConfig()
const route = useRoute()
const demo = config.public.officeMode === 'demo'
const { fetch: muatSesi } = useUserSession()

const email = ref('')
const password = ref('')
const mengirim = ref(false)
const galat = ref<string | null>(null)

const tujuan = computed(() => {
  const l = route.query.lanjut
  return typeof l === 'string' && l.startsWith('/') ? l : '/'
})

async function masuk() {
  galat.value = null
  mengirim.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { email: email.value.trim(), password: password.value } })
    await muatSesi()
    await navigateTo(tujuan.value)
  } catch (e: unknown) {
    const pesan = (e as { data?: { statusMessage?: string }, message?: string })?.data?.statusMessage
      ?? (e instanceof Error ? e.message : 'Gagal masuk')
    galat.value = pesan
  } finally {
    mengirim.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh bg-shell flex items-center justify-center px-4 py-10">
    <div class="w-full max-w-sm">
      <div class="flex items-center gap-2.5 mb-8">
        <span class="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center" aria-hidden="true">
          <UIcon name="i-lucide-hexagon" class="size-4.5" />
        </span>
        <div class="leading-tight">
          <p class="text-base font-semibold text-highlighted">{{ config.public.appName }}</p>
          <p class="text-xs text-muted">Control plane AI employee</p>
        </div>
      </div>

      <UCard>
        <template v-if="demo">
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-2">
              <BadgeDemo ukuran="sm" />
              <h1 class="text-lg font-semibold text-highlighted">Mode demo</h1>
            </div>
            <p class="text-sm text-toned leading-relaxed">
              Instance ini berjalan dengan data simulasi. Tidak perlu masuk; semua kartu berlabel DEMO dan aksi kontrol tidak tersedia.
            </p>
            <UButton to="/" icon="i-lucide-arrow-right" trailing label="Masuk ke demo" block />
          </div>
        </template>

        <form v-else class="flex flex-col gap-4" aria-label="Formulir masuk" @submit.prevent="masuk">
          <h1 class="text-lg font-semibold text-highlighted">Masuk</h1>
          <UFormField label="Email" name="email" required>
            <UInput v-model="email" type="email" autocomplete="email" placeholder="nama@perusahaan.id" class="w-full" required />
          </UFormField>
          <UFormField label="Kata sandi" name="password" required>
            <UInput v-model="password" type="password" autocomplete="current-password" class="w-full" required />
          </UFormField>
          <UAlert v-if="galat" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="galat" />
          <UButton type="submit" label="Masuk" icon="i-lucide-log-in" block :loading="mengirim" :disabled="!email || !password" />
        </form>
      </UCard>
    </div>
  </div>
</template>
