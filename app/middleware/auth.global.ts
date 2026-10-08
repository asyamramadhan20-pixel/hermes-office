/**
 * Deny-by-default: semua halaman butuh login kecuali yang terdaftar.
 * Mode demo (fixture, tanpa aksi kontrol) tidak memerlukan sesi.
 */
const PUBLIK = ['/login']

export default defineNuxtRouteMiddleware((to) => {
  const demo = useRuntimeConfig().public.officeMode === 'demo'
  if (demo) return
  const { loggedIn } = useUserSession()
  const publik = PUBLIK.includes(to.path)
  if (!loggedIn.value && !publik) return navigateTo(`/login?lanjut=${encodeURIComponent(to.fullPath)}`)
  if (loggedIn.value && to.path === '/login') return navigateTo('/')
})
