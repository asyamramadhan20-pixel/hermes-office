export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  ui: {
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error']
    }
  },
  nitro: {
    preset: 'node-server',
    externals: { inline: ['vue'] }
  },
  typescript: { strict: true },
  devtools: { enabled: false },
  runtimeConfig: {
    /** PRIVAT — hanya di server. */
    databaseUrl: process.env.DATABASE_URL || '',
    /** Kunci AES-256-GCM untuk kredensial runtime (API key Hermes, secret outbound). */
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    /** Matikan worker/rekonsiliasi (mis. saat test). */
    workerNonaktif: process.env.OFFICE_WORKER_NONAKTIF || '',
    public: {
      appName: 'Hermes Virtual Office',
      /**
       * demo  = fixture deterministik berlabel DEMO, tanpa aksi kontrol.
       * live  = data dari API control plane. Tidak ada mode lain.
       */
      officeMode: process.env.NUXT_PUBLIC_OFFICE_MODE || 'live',
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'
    }
  }
})
