import { wajibAnggota, orgIdDariRoute } from '~~/server/utils/tenant'
import { daftarTugas } from '~~/server/utils/ringkasan'

export default defineEventHandler(async (event) => {
  const { org } = await wajibAnggota(event, orgIdDariRoute(event))
  return daftarTugas(org.id)
})
