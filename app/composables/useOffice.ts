/**
 * Sumber data tunggal UI. Mode `demo` = fixture deterministik berlabel DEMO (tanpa aksi kontrol);
 * mode `live` = API control plane `/api/me`, `/api/orgs/:orgId/*`.
 */
import type { ProfilSaya, RingkasanOrg, TugasRingkas, EventRingkas, BuatPerintah, PerintahRingkas } from '~~/shared/kontrak'
import { PERAN_BOLEH_PERINTAH, PERAN_BOLEH_APPROVAL, type PeranOrg } from '~~/shared/status'
import profilDemo from '~~/fixtures/demo/profil.json'
import ringkasanDemo from '~~/fixtures/demo/ringkasan.json'
import tugasDemo from '~~/fixtures/demo/tugas.json'

export type ModeOffice = 'demo' | 'live'
const KUNCI_ORG = 'office.orgAktif'

const PROFIL_DEMO = profilDemo as ProfilSaya
const RINGKASAN_DEMO = ringkasanDemo as RingkasanOrg
const TUGAS_DEMO = tugasDemo as TugasRingkas[]

export function useOffice() {
  const config = useRuntimeConfig()
  const mode: ModeOffice = config.public.officeMode === 'demo' ? 'demo' : 'live'
  const demo = mode === 'demo'
  /** $fetch yang meneruskan cookie sesi saat SSR (tanpa ini, /api/* di server balas 401 dan data tidak pernah terisi). */
  const ambil = useRequestFetch()

  /** Organisasi aktif; dipersistenkan di localStorage (klien). */
  const orgAktif = useState<string | null>(KUNCI_ORG, () => null)
  const sudahMuat = useState<boolean>(`${KUNCI_ORG}.muat`, () => false)
  if (import.meta.client && !sudahMuat.value) {
    sudahMuat.value = true
    try {
      const tersimpan = localStorage.getItem(KUNCI_ORG)
      if (tersimpan) orgAktif.value = tersimpan
    } catch { /* storage tidak tersedia */ }
    watch(orgAktif, (v) => {
      try {
        if (v) localStorage.setItem(KUNCI_ORG, v)
        else localStorage.removeItem(KUNCI_ORG)
      } catch { /* abaikan */ }
    })
  }

  function profil() {
    const hasil = useAsyncData<ProfilSaya>('office.profil', () =>
      demo ? Promise.resolve(PROFIL_DEMO) : ambil<ProfilSaya>('/api/me'))
    // Pilih organisasi pertama bila belum ada / tidak valid.
    watch(hasil.data, (p) => {
      if (!p) return
      const ada = p.organizations.some(o => o.id === orgAktif.value)
      if (!ada) orgAktif.value = p.organizations[0]?.id ?? null
    }, { immediate: true, flush: 'sync' }) // sync: agar juga jalan saat SSR setelah `await profil()`
    return hasil
  }

  function ringkasan(orgId: MaybeRefOrGetter<string | null>) {
    const id = computed(() => toValue(orgId))
    return useAsyncData<RingkasanOrg | null>(
      () => `office.ringkasan.${id.value ?? 'none'}`,
      () => {
        if (!id.value) return Promise.resolve(null)
        return demo ? Promise.resolve(RINGKASAN_DEMO) : ambil<RingkasanOrg>(`/api/orgs/${id.value}/ringkasan`)
      },
      { watch: [id] }
    )
  }

  function tugas(orgId: MaybeRefOrGetter<string | null>) {
    const id = computed(() => toValue(orgId))
    return useAsyncData<TugasRingkas[]>(
      () => `office.tugas.${id.value ?? 'none'}`,
      () => {
        if (!id.value) return Promise.resolve([])
        return demo ? Promise.resolve(TUGAS_DEMO) : ambil<TugasRingkas[]>(`/api/orgs/${id.value}/tasks`)
      },
      { watch: [id], default: () => [] }
    )
  }

  function events(orgId: MaybeRefOrGetter<string | null>) {
    const id = computed(() => toValue(orgId))
    return useAsyncData<EventRingkas[]>(
      () => `office.events.${id.value ?? 'none'}`,
      () => {
        if (!id.value) return Promise.resolve([])
        return demo ? Promise.resolve(RINGKASAN_DEMO.aktivitasTerbaru) : ambil<EventRingkas[]>(`/api/orgs/${id.value}/events`, { query: { json: 1 } })
      },
      { watch: [id], default: () => [] }
    )
  }

  /** Peran pengguna pada organisasi aktif (dari profil yang sudah dimuat). */
  const peranAktif = computed<PeranOrg | null>(() => {
    const p = useNuxtData<ProfilSaya>('office.profil').data.value
    return p?.organizations.find(o => o.id === orgAktif.value)?.role ?? null
  })

  /** Aksi kontrol (kirim tugas, batalkan) hanya di mode live + peran yang berhak. */
  const bolehAksi = computed(() => mode === 'live' && !!peranAktif.value && PERAN_BOLEH_PERINTAH.includes(peranAktif.value))
  /** Menjawab approval hanya di mode live + peran owner/approver. */
  const bolehApproval = computed(() => mode === 'live' && !!peranAktif.value && PERAN_BOLEH_APPROVAL.includes(peranAktif.value))

  /** Kirim command ke control plane (hanya live). */
  async function kirimPerintah(orgId: string, body: BuatPerintah): Promise<{ command: PerintahRingkas, taskId: string | null }> {
    if (demo) throw new Error('Mode demo: aksi dinonaktifkan')
    return $fetch<{ command: PerintahRingkas, taskId: string | null }>(`/api/orgs/${orgId}/commands`, { method: 'POST', body })
  }

  return { mode, demo, orgAktif, peranAktif, bolehAksi, bolehApproval, profil, ringkasan, tugas, events, kirimPerintah }
}
