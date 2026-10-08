import { wajibAnggota, orgIdDariRoute } from '~~/server/utils/tenant'
import { daftarKaryawan } from '~~/server/utils/ringkasan'

export default defineEventHandler(async (event) => {
  const { org } = await wajibAnggota(event, orgIdDariRoute(event))
  return daftarKaryawan(org.id)
})
