import { wajibAnggota, orgIdDariRoute } from '~~/server/utils/tenant'
import { ringkasanOrg } from '~~/server/utils/ringkasan'

export default defineEventHandler(async (event) => {
  const { org, role } = await wajibAnggota(event, orgIdDariRoute(event))
  return ringkasanOrg({ id: org.id, slug: org.slug, name: org.name, role })
})
