/**
 * Enum status yang dipakai server & klien. Definisi tunggal — jangan diduplikasi.
 * Nama dalam bahasa Inggris (kontrak), label UI diterjemahkan di `LABEL_*`.
 */
export const PERAN_ORG = ['owner', 'manager', 'member', 'approver', 'auditor'] as const
export type PeranOrg = typeof PERAN_ORG[number]
/** Peran yang boleh mengirim command (tugas/cancel). */
export const PERAN_BOLEH_PERINTAH: PeranOrg[] = ['owner', 'manager', 'member']
/** Peran yang boleh menjawab approval. */
export const PERAN_BOLEH_APPROVAL: PeranOrg[] = ['owner', 'approver']
/** Peran yang boleh mengelola anggota & AI employee. */
export const PERAN_BOLEH_KELOLA: PeranOrg[] = ['owner', 'manager']

export const STATUS_TUGAS = [
  'CREATED', 'QUEUED', 'ASSIGNED', 'RUNNING', 'WAITING_APPROVAL', 'BLOCKED',
  'COMPLETED', 'FAILED', 'CANCEL_REQUESTED', 'CANCELLED', 'UNKNOWN'
] as const
export type StatusTugas = typeof STATUS_TUGAS[number]
export const STATUS_TUGAS_TERMINAL: StatusTugas[] = ['COMPLETED', 'FAILED', 'CANCELLED']

export const STATUS_RUN = [
  'queued', 'running', 'waiting_for_approval', 'stopping',
  'completed', 'failed', 'cancelled', 'interrupted', 'unknown'
] as const
export type StatusRun = typeof STATUS_RUN[number]
export const STATUS_RUN_TERMINAL: StatusRun[] = ['completed', 'failed', 'cancelled', 'interrupted']

export const JENIS_PERINTAH = [
  'ASSIGN_TASK', 'REQUEST_STATUS', 'REQUEST_CANCEL', 'SUBMIT_APPROVAL'
] as const
export type JenisPerintah = typeof JENIS_PERINTAH[number]

export const STATE_PERINTAH = [
  'CREATED', 'QUEUED', 'DISPATCHING', 'ACCEPTED', 'RUNNING', 'SUCCEEDED',
  'REJECTED', 'FAILED', 'CANCEL_REQUESTED', 'CANCELLED', 'UNKNOWN'
] as const
export type StatePerintah = typeof STATE_PERINTAH[number]

export const STATUS_APPROVAL = ['pending', 'approved', 'denied', 'expired', 'unknown'] as const
export type StatusApproval = typeof STATUS_APPROVAL[number]

export const STATUS_RUNTIME = ['unknown', 'online', 'offline'] as const
export type StatusRuntime = typeof STATUS_RUNTIME[number]

/** Pemetaan status run Hermes (`GET /v1/runs/{id}`) → status tugas. */
export function statusTugasDariRun(s: StatusRun): StatusTugas {
  switch (s) {
    case 'queued': return 'QUEUED'
    case 'running': return 'RUNNING'
    case 'waiting_for_approval': return 'WAITING_APPROVAL'
    case 'stopping': return 'CANCEL_REQUESTED'
    case 'completed': return 'COMPLETED'
    case 'failed': return 'FAILED'
    case 'cancelled': return 'CANCELLED'
    case 'interrupted': return 'UNKNOWN'
    default: return 'UNKNOWN'
  }
}

export const LABEL_STATUS_TUGAS: Record<StatusTugas, string> = {
  CREATED: 'Dibuat', QUEUED: 'Antre', ASSIGNED: 'Ditugaskan', RUNNING: 'Berjalan',
  WAITING_APPROVAL: 'Menunggu persetujuan', BLOCKED: 'Terhambat', COMPLETED: 'Selesai',
  FAILED: 'Gagal', CANCEL_REQUESTED: 'Pembatalan diminta', CANCELLED: 'Dibatalkan', UNKNOWN: 'Tidak diketahui'
}
