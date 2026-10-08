import { wajibPlatformAdmin } from '~~/server/utils/auth'
import { jalankanWorkerPerintah } from '~~/server/utils/perintah'
import { rekonsiliasiSekali, segarkanRuntime, tutupRunEksternalBasi } from '~~/server/plugins/rekonsiliasi'

/** Jalankan satu putaran worker command + rekonsiliasi sekarang (operasional & test). */
export default defineEventHandler(async (event) => {
  await wajibPlatformAdmin(event)
  const q = getQuery(event)
  if (q.runtime !== '0') await segarkanRuntime()
  const diproses = await jalankanWorkerPerintah()
  await rekonsiliasiSekali(true)
  // ?majuMenit=N: evaluasi run eksternal basi seolah waktu sudah maju N menit (hanya untuk test/operasional).
  const maju = Number(q.majuMenit ?? 0)
  await tutupRunEksternalBasi(Date.now() + (Number.isFinite(maju) ? maju * 60_000 : 0))
  return { diproses }
})
