import { jalankanWorkerPerintah } from '~~/server/utils/perintah'

/** Worker command bridge: tiap 3 detik ambil command QUEUED/UNKNOWN. Satu replika → tanpa lock lintas proses. */
export default defineNitroPlugin(() => {
  if (useRuntimeConfig().workerNonaktif) return
  let sibuk = false
  const tick = async () => {
    if (sibuk) return
    sibuk = true
    try { await jalankanWorkerPerintah() } catch (e) { console.error('[perintah-worker]', e) } finally { sibuk = false }
  }
  setTimeout(tick, 5_000)
  setInterval(tick, 3_000)
})
