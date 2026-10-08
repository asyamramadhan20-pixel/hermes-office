<script setup lang="ts">
const config = useRuntimeConfig()
useHead({
  titleTemplate: (judul?: string) => judul ? `${judul} · ${config.public.appName}` : config.public.appName,
  htmlAttrs: { lang: 'id' }
})
</script>

<template>
  <UApp :toaster="{ position: 'bottom-right' }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
