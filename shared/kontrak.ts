/**
 * Kontrak data UI ↔ control plane. Dipakai `useOffice` (klien) dan endpoint `/api/orgs/:orgId/*` (server).
 * Mode demo memakai fixture yang MEMENUHI tipe ini, ditandai `demo: true` di `RingkasanOrg`.
 */
import type { StatusTugas, StatusRun, StatusApproval, StatusRuntime, PeranOrg, StatePerintah } from './status'

export interface OrgRingkas { id: string, slug: string, name: string, role: PeranOrg }

export interface ProfilSaya {
  user: { id: string, email: string, name: string, isPlatformAdmin: boolean }
  organizations: OrgRingkas[]
}

export interface KaryawanAI {
  id: string
  name: string
  jobTitle: string
  department: string
  specialization: string | null
  isSupervisor: boolean
  isActive: boolean
  /** Nama profil Hermes yang dipetakan ke employee ini (sesi Telegram/CLI tampil di kantor lewat ini). */
  hermesProfile?: string | null
  /** Dihitung dari agent_runs non-terminal. */
  runAktif: number
  /** Dari event terakhir yang terkait. null = belum pernah terlihat. */
  terakhirTerlihat: string | null
  tugasAktif: { id: string, title: string, status: StatusTugas } | null
}

export interface TugasRingkas {
  id: string
  title: string
  status: StatusTugas
  priority: number
  /** dashboard = ASSIGN_TASK; external = sesi Hermes dari luar dashboard (dibuat otomatis dari event). */
  origin?: 'dashboard' | 'external'
  employee: { id: string, name: string } | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  outputSummary: string | null
  lastError: string | null
  runUtama: { id: string, hermesRunId: string | null, status: StatusRun } | null
}

export interface EventRingkas {
  id: string
  taskId: string | null
  runId: string | null
  sourceEventType: string
  source: 'webhook' | 'poll' | 'command' | 'system'
  occurredAt: string
  data: Record<string, unknown>
}

export interface ApprovalRingkas {
  id: string
  taskId: string | null
  command: string
  description: string | null
  riskClass: string
  status: StatusApproval
  createdAt: string
}

export interface RuntimeRingkas {
  /** null = runtime belum dipasang untuk organisasi ini. */
  terpasang: boolean
  name: string | null
  status: StatusRuntime
  hermesVersion: string | null
  lastSeenAt: string | null
  lastError: string | null
  /** Fitur dari /v1/capabilities; kosong = belum pernah terdeteksi. */
  fitur: Record<string, boolean>
  /** Menit sejak event terakhir; null bila belum ada. UI: > 10 mnt = "basi". */
  menitSejakEventTerakhir: number | null
}

export interface RingkasanOrg {
  /** true hanya di mode demo (fixture). UI wajib menampilkan badge DEMO. */
  demo: boolean
  org: OrgRingkas
  dihitungPada: string
  tugas: { total: number, berjalan: number, menungguApproval: number, selesai7Hari: number, gagal7Hari: number, tidakDiketahui: number }
  approvalTertunda: number
  runtime: RuntimeRingkas
  karyawan: KaryawanAI[]
  aktivitasTerbaru: EventRingkas[]
}

export interface PerintahRingkas {
  id: string
  type: 'ASSIGN_TASK' | 'REQUEST_STATUS' | 'REQUEST_CANCEL' | 'SUBMIT_APPROVAL'
  state: StatePerintah
  taskId: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

/** Body POST /api/orgs/:orgId/commands */
export type BuatPerintah =
  | { type: 'ASSIGN_TASK', employeeId: string, title: string, objective: string, priority?: number }
  | { type: 'REQUEST_CANCEL', taskId: string }
  | { type: 'REQUEST_STATUS', taskId: string }
  | { type: 'SUBMIT_APPROVAL', approvalId: string, choice: 'once' | 'deny' }
