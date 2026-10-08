import { wajibPlatformAdmin } from '~~/server/utils/auth'
import { jalankanWorkerPerintah } from '~~/server/utils/perintah'
import { rekonsiliasiSekali, segarkanRuntime } from '~~/server/plugins/rekonsiliasi'

/** Jalankan satu putaran worker command + rekonsiliasi sekarang (operasional & test). */
export default defineEventHandler(async (event) => {
  await wajibPlatformAdmin(event)
  const q = getQuery(event)
  if (q.runtime !== '0') await segarkanRuntime()
  const diproses = await jalankanWorkerPerintah()
  await rekonsiliasiSekali(true)
  return { diproses }
})
