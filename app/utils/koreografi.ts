/**
 * Koreografi kantor 3D: menurunkan "aksi" tiap karakter DARI DATA (tugas + event), bukan dari animasi acak.
 * - mode: keadaan utama (dari status tugas aktif / riwayat terbaru)
 * - reaksi: event nyata terbaru (≤ 90 dtk) → gerakan kecil + chip label
 * - subagentAktif: subagent.started yang belum subagent.finished → asisten kecil tampil
 * - tempo: jumlah event 5 menit terakhir → kecepatan "mengetik"
 */
import type { KaryawanAI, TugasRingkas, EventRingkas } from '~~/shared/kontrak'

export type ModeKarakter = 'nonaktif' | 'idle' | 'berangkat' | 'kerja' | 'menunggu_persetujuan' | 'membatalkan' | 'tidak_diketahui' | 'rayakan' | 'gagal' | 'delegasi'
export interface ReaksiKarakter { id: string, jenis: string, label: string, pada: number }
export interface AksiKarakter { mode: ModeKarakter, reaksi: ReaksiKarakter | null, subagentAktif: number, tempo: number, tugasId: string | null }

const AKTIF = new Set(['CREATED', 'QUEUED', 'ASSIGNED', 'RUNNING', 'WAITING_APPROVAL', 'BLOCKED', 'CANCEL_REQUESTED', 'UNKNOWN'])
const PRIORITAS: Record<string, number> = { WAITING_APPROVAL: 0, CANCEL_REQUESTED: 1, RUNNING: 2, BLOCKED: 3, QUEUED: 4, ASSIGNED: 4, CREATED: 5, UNKNOWN: 6 }
const JENDELA_REAKSI_MS = 90_000
const JENDELA_RAYAKAN_MS = 3 * 60_000
const JENDELA_TEMPO_MS = 5 * 60_000

export function labelEvent(e: EventRingkas): string {
  const d = e.data as Record<string, unknown>
  switch (e.sourceEventType) {
    case 'tool.completed': return `tool: ${d.tool ?? d.toolName ?? '?'}`
    case 'tool.started': return `mulai tool: ${d.tool ?? d.toolName ?? '?'}`
    case 'subagent.started': return 'subagent mulai'
    case 'subagent.finished': return 'subagent selesai'
    case 'approval.requested': return 'minta persetujuan'
    case 'approval.resolved': case 'approval.submitted': return 'persetujuan dijawab'
    case 'run.completed': return 'run selesai'
    case 'run.failed': return 'run gagal'
    case 'run.cancelled': return 'run dibatalkan'
    case 'run.running': return 'run berjalan'
    case 'run.submitted': return 'run dikirim'
    case 'run.stop_requested': return 'stop diminta'
    case 'session.started': return 'sesi mulai'
    case 'session.turn_ended': return 'giliran selesai'
    case 'command.persisted': return 'perintah dicatat'
    case 'poll.status': return `status: ${d.status ?? '?'}`
    default: return e.sourceEventType
  }
}

export function turunkanAksi(k: KaryawanAI, tugas: TugasRingkas[], events: EventRingkas[], sekarang = Date.now()): AksiKarakter {
  if (!k.isActive) return { mode: 'nonaktif', reaksi: null, subagentAktif: 0, tempo: 0, tugasId: null }
  const milik = tugas.filter(t => t.employee?.id === k.id)
  const idTugas = new Set(milik.map(t => t.id))
  const evMilik = events.filter(e => e.taskId && idTugas.has(e.taskId)).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))

  const aktif = milik.filter(t => AKTIF.has(t.status)).sort((a, b) => (PRIORITAS[a.status] ?? 9) - (PRIORITAS[b.status] ?? 9))[0] ?? null
  let mode: ModeKarakter = 'idle'
  if (aktif) {
    switch (aktif.status) {
      case 'WAITING_APPROVAL': mode = 'menunggu_persetujuan'; break
      case 'CANCEL_REQUESTED': mode = 'membatalkan'; break
      case 'RUNNING': case 'BLOCKED': mode = 'kerja'; break
      case 'UNKNOWN': mode = 'tidak_diketahui'; break
      default: mode = 'berangkat' // CREATED/QUEUED/ASSIGNED: baru ditugaskan → berjalan dari gedung ke meja
    }
  } else {
    const terakhir = milik.filter(t => t.finishedAt).sort((a, b) => Date.parse(b.finishedAt!) - Date.parse(a.finishedAt!))[0]
    if (terakhir && sekarang - Date.parse(terakhir.finishedAt!) < JENDELA_RAYAKAN_MS) mode = terakhir.status === 'COMPLETED' ? 'rayakan' : terakhir.status === 'FAILED' ? 'gagal' : 'idle'
  }
  // runAktif dari agent_runs tetap jadi sumber "kerja" bila status tugas belum tersinkron
  if (mode === 'idle' && k.runAktif > 0) mode = 'kerja'

  const terbaru = evMilik[0]
  const reaksi = terbaru && sekarang - Date.parse(terbaru.occurredAt) <= JENDELA_REAKSI_MS
    ? { id: terbaru.id, jenis: terbaru.sourceEventType, label: labelEvent(terbaru), pada: Date.parse(terbaru.occurredAt) } : null

  let subagentAktif = 0
  if (aktif) {
    const evAktif = evMilik.filter(e => e.taskId === aktif.id)
    const mulai = evAktif.filter(e => e.sourceEventType === 'subagent.started').length
    const selesai = evAktif.filter(e => e.sourceEventType === 'subagent.finished').length
    subagentAktif = Math.max(0, Math.min(3, mulai - selesai))
  }
  const tempo = evMilik.filter(e => sekarang - Date.parse(e.occurredAt) <= JENDELA_TEMPO_MS).length
  return { mode, reaksi, subagentAktif, tempo, tugasId: aktif?.id ?? null }
}

/** Supervisor: "delegasi" bila ada tugas baru (≤3 mnt) atau perintah dicatat (≤90 dtk). */
export function turunkanAksiSupervisor(k: KaryawanAI, tugas: TugasRingkas[], events: EventRingkas[], sekarang = Date.now()): AksiKarakter {
  const dasar = turunkanAksi(k, tugas, events, sekarang)
  const baru = tugas.some(t => ['CREATED', 'QUEUED', 'ASSIGNED'].includes(t.status) && sekarang - Date.parse(t.createdAt) < 3 * 60_000)
  const evDelegasi = events.filter(e => ['command.persisted', 'run.submitted'].includes(e.sourceEventType) && sekarang - Date.parse(e.occurredAt) <= JENDELA_REAKSI_MS)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0]
  if ((baru || evDelegasi) && dasar.mode === 'idle') dasar.mode = 'delegasi'
  if (evDelegasi && !dasar.reaksi) dasar.reaksi = { id: evDelegasi.id, jenis: evDelegasi.sourceEventType, label: labelEvent(evDelegasi), pada: Date.parse(evDelegasi.occurredAt) }
  return dasar
}

export const LABEL_MODE: Record<ModeKarakter, string> = {
  nonaktif: 'nonaktif', idle: 'idle', berangkat: 'menerima tugas', kerja: 'bekerja', menunggu_persetujuan: 'menunggu persetujuan',
  membatalkan: 'membatalkan', tidak_diketahui: 'status tidak diketahui', rayakan: 'selesai', gagal: 'gagal', delegasi: 'mendelegasikan'
}
