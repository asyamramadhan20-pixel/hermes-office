import { sql } from 'drizzle-orm'
import {
  pgTable, pgEnum, text, timestamp, uuid, jsonb, boolean, integer, uniqueIndex, index
} from 'drizzle-orm/pg-core'
import {
  PERAN_ORG, STATUS_TUGAS, STATUS_RUN, JENIS_PERINTAH, STATE_PERINTAH, STATUS_APPROVAL, STATUS_RUNTIME
} from '../../shared/status'

/*
 * Skema control plane. Semua tabel milik tenant membawa `organization_id` + index,
 * dan setiap query tenant WAJIB memfilter kolom itu (lihat server/utils/tenant.ts).
 */

export const peranOrgEnum = pgEnum('org_role', PERAN_ORG)
export const statusTugasEnum = pgEnum('task_status', STATUS_TUGAS)
export const statusRunEnum = pgEnum('run_status', STATUS_RUN)
export const jenisPerintahEnum = pgEnum('command_type', JENIS_PERINTAH)
export const statePerintahEnum = pgEnum('command_state', STATE_PERINTAH)
export const statusApprovalEnum = pgEnum('approval_status', STATUS_APPROVAL)
export const statusRuntimeEnum = pgEnum('runtime_status', STATUS_RUNTIME)
/** external = giliran sesi Hermes yang TIDAK dimulai dari dashboard (Telegram/CLI), dipetakan lewat ai_employees.hermes_profile. */
export const jenisRunEnum = pgEnum('run_kind', ['main', 'subagent', 'external'])
export const sumberEventEnum = pgEnum('event_source', ['webhook', 'poll', 'command', 'system'])

const waktu = (nama: string) => timestamp(nama, { withTimezone: true })

/* ════════════ SaaS ════════════ */

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: waktu('created_at').notNull().defaultNow()
}, t => [uniqueIndex('organizations_slug_key').on(t.slug)])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  /** argon2id. Tidak pernah dikirim ke klien. */
  passwordHash: text('password_hash').notNull(),
  /** Admin platform SaaS: kelola organisasi & runtime, bukan anggota tenant otomatis. */
  isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: waktu('locked_until'),
  lastLoginAt: waktu('last_login_at'),
  createdAt: waktu('created_at').notNull().defaultNow()
}, t => [uniqueIndex('users_email_key').on(sql`lower(${t.email})`)])

export const organizationMemberships = pgTable('organization_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: peranOrgEnum('role').notNull().default('member'),
  createdAt: waktu('created_at').notNull().defaultNow()
}, t => [
  uniqueIndex('org_memberships_org_user_key').on(t.organizationId, t.userId),
  index('org_memberships_user_idx').on(t.userId)
])

/* ════════════ Tenaga kerja AI ════════════ */

/** AI employee permanen milik tenant (peran logis, bukan proses). */
export const aiEmployees = pgTable('ai_employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  jobTitle: text('job_title').notNull(),
  department: text('department').notNull().default('Umum'),
  specialization: text('specialization'),
  /** SOP dikirim sebagai `instructions` saat ASSIGN_TASK. */
  sop: text('sop'),
  /** Daftar nama tool yang diizinkan (informatif; penegakan ada di runtime Hermes). */
  allowedTools: jsonb('allowed_tools').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  /** MasterCEO = supervisor; hanya satu per tenant. */
  isSupervisor: boolean('is_supervisor').notNull().default(false),
  /** Nama profil Hermes (`profile` di payload webhook) yang mewakili employee ini; sesi di luar dashboard dipetakan lewat ini. */
  hermesProfile: text('hermes_profile'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: waktu('created_at').notNull().defaultNow(),
  updatedAt: waktu('updated_at').notNull().defaultNow()
}, t => [index('ai_employees_org_idx').on(t.organizationId), uniqueIndex('ai_employees_org_profile_key').on(t.organizationId, t.hermesProfile)])

/* ════════════ Runtime ════════════ */

export const runtimeInstances = pgTable('runtime_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** 1 runtime per tenant (Phase 1). */
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('utama'),
  /** Base URL API server Hermes di jaringan privat, mis. http://10.0.0.5:8642 */
  baseUrl: text('base_url').notNull(),
  /** sha256 dari kunci URL webhook inbound; kunci mentahnya hanya tampil sekali. */
  webhookKeyHash: text('webhook_key_hash').notNull(),
  /** Hasil `GET /v1/capabilities` terakhir, apa adanya. */
  capabilities: jsonb('capabilities').$type<Record<string, unknown> | null>(),
  hermesVersion: text('hermes_version'),
  status: statusRuntimeEnum('status').notNull().default('unknown'),
  lastSeenAt: waktu('last_seen_at'),
  lastError: text('last_error'),
  createdAt: waktu('created_at').notNull().defaultNow()
}, t => [
  uniqueIndex('runtime_instances_org_key').on(t.organizationId),
  uniqueIndex('runtime_instances_webhook_key').on(t.webhookKeyHash)
])

/** Rahasia per runtime: `api_key` (Bearer ke Hermes) dan `outbound_secret` (HMAC webhook masuk). */
export const runtimeCredentials = pgTable('runtime_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  runtimeId: uuid('runtime_id').notNull().references(() => runtimeInstances.id, { onDelete: 'cascade' }),
  fieldKey: text('field_key').notNull(),
  secretEnc: text('secret_enc').notNull(),
  maskedPreview: text('masked_preview').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: waktu('updated_at').notNull().defaultNow()
}, t => [uniqueIndex('runtime_credentials_key').on(t.runtimeId, t.fieldKey)])

/* ════════════ Operasi ════════════ */

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').references(() => aiEmployees.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  parentTaskId: uuid('parent_task_id'),
  title: text('title').notNull(),
  objective: text('objective').notNull(),
  priority: integer('priority').notNull().default(3),
  status: statusTugasEnum('status').notNull().default('CREATED'),
  /** dashboard = dibuat lewat ASSIGN_TASK; external = sesi Hermes dari luar (Telegram/CLI), tugasnya dibuat otomatis dari event. */
  origin: text('origin').notNull().default('dashboard'),
  deadlineAt: waktu('deadline_at'),
  startedAt: waktu('started_at'),
  finishedAt: waktu('finished_at'),
  outputSummary: text('output_summary'),
  lastError: text('last_error'),
  /** Bukti status terminal: event_id / run_id yang menetapkannya. */
  terminalEvidence: jsonb('terminal_evidence').$type<Record<string, unknown> | null>(),
  createdAt: waktu('created_at').notNull().defaultNow(),
  updatedAt: waktu('updated_at').notNull().defaultNow()
}, t => [
  index('tasks_org_status_idx').on(t.organizationId, t.status),
  index('tasks_org_created_idx').on(t.organizationId, t.createdAt)
])

/** Eksekusi Hermes yang sesungguhnya (run utama atau subagent). */
export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').references(() => aiEmployees.id, { onDelete: 'set null' }),
  runtimeId: uuid('runtime_id').references(() => runtimeInstances.id, { onDelete: 'set null' }),
  parentRunId: uuid('parent_run_id'),
  kind: jenisRunEnum('kind').notNull().default('main'),
  /** `run_id` dari POST /v1/runs (hanya run utama). */
  hermesRunId: text('hermes_run_id'),
  /** `session_id` Hermes (run utama: dari status; subagent: child_session_id). */
  hermesSessionId: text('hermes_session_id'),
  hermesSubagentId: text('hermes_subagent_id'),
  delegationId: text('delegation_id'),
  status: statusRunEnum('status').notNull().default('queued'),
  startedAt: waktu('started_at'),
  endedAt: waktu('ended_at'),
  /** Jawaban akhir / ringkasan child, sudah diredaksi. */
  output: text('output'),
  usage: jsonb('usage').$type<Record<string, unknown> | null>(),
  runtimeInfo: jsonb('runtime_info').$type<Record<string, unknown> | null>(),
  lastError: text('last_error'),
  lastPolledAt: waktu('last_polled_at'),
  createdAt: waktu('created_at').notNull().defaultNow(),
  updatedAt: waktu('updated_at').notNull().defaultNow()
}, t => [
  uniqueIndex('agent_runs_hermes_run_key').on(t.organizationId, t.hermesRunId),
  index('agent_runs_session_idx').on(t.organizationId, t.hermesSessionId),
  index('agent_runs_task_idx').on(t.taskId),
  index('agent_runs_status_idx').on(t.status)
])

/** Event ternormalisasi (PRD §06). Append-only. */
export const taskEvents = pgTable('task_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  runId: uuid('run_id').references(() => agentRuns.id, { onDelete: 'cascade' }),
  runtimeId: uuid('runtime_id').references(() => runtimeInstances.id, { onDelete: 'set null' }),
  /** delivery_id Hermes, atau id buatan untuk event poll/command. Unik per organisasi. */
  eventId: text('event_id').notNull(),
  source: sumberEventEnum('source').notNull(),
  sourceEventType: text('source_event_type').notNull(),
  hermesSessionId: text('hermes_session_id'),
  occurredAt: waktu('occurred_at').notNull(),
  receivedAt: waktu('received_at').notNull().defaultNow(),
  payloadVersion: text('payload_version').notNull().default('hermes.observer.v1'),
  /** Metadata aman (sudah diredaksi). */
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`)
}, t => [
  uniqueIndex('task_events_event_id_key').on(t.organizationId, t.eventId),
  index('task_events_task_idx').on(t.taskId, t.occurredAt),
  index('task_events_org_received_idx').on(t.organizationId, t.receivedAt)
])

/** Command bridge: dipersist dulu, baru dikirim (PRD §07). */
export const commands = pgTable('commands', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  runId: uuid('run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
  type: jenisPerintahEnum('type').notNull(),
  state: statePerintahEnum('state').notNull().default('CREATED'),
  /** Dipakai juga sebagai header Idempotency-Key ke Hermes. */
  idempotencyKey: text('idempotency_key').notNull(),
  correlationId: text('correlation_id').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  result: jsonb('result').$type<Record<string, unknown> | null>(),
  lastError: text('last_error'),
  attempts: integer('attempts').notNull().default(0),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  lockedAt: waktu('locked_at'),
  nextAttemptAt: waktu('next_attempt_at').notNull().defaultNow(),
  createdAt: waktu('created_at').notNull().defaultNow(),
  updatedAt: waktu('updated_at').notNull().defaultNow()
}, t => [
  uniqueIndex('commands_idempotency_key').on(t.idempotencyKey),
  index('commands_state_next_idx').on(t.state, t.nextAttemptAt),
  index('commands_org_created_idx').on(t.organizationId, t.createdAt)
])

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  runId: uuid('run_id').references(() => agentRuns.id, { onDelete: 'cascade' }),
  /** request_id dari event `approval.request` Hermes (bila ada). */
  hermesRequestId: text('hermes_request_id'),
  /** Perintah yang diminta, SUDAH diredaksi oleh Hermes + kita. */
  command: text('command').notNull(),
  description: text('description'),
  riskClass: text('risk_class').notNull().default('external_mutation'),
  status: statusApprovalEnum('status').notNull().default('pending'),
  choice: text('choice'),
  decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
  decidedAt: waktu('decided_at'),
  createdAt: waktu('created_at').notNull().defaultNow()
}, t => [index('approvals_org_status_idx').on(t.organizationId, t.status)])

/* ════════════ Inbox & audit ════════════ */

/** Event mentah dari Hermes, disimpan SEBELUM di-ACK. */
export const webhookInbox = pgTable('webhook_inbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  runtimeId: uuid('runtime_id').notNull().references(() => runtimeInstances.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  deliveryId: text('delivery_id').notNull(),
  eventName: text('event_name').notNull(),
  signatureOk: boolean('signature_ok').notNull(),
  /** Body yang SUDAH disaring (server/utils/hermes-saring.ts): tanpa tool_input, extra.result, conversation_history, dll. */
  body: jsonb('body').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  /** SHA-256 raw body untuk audit/duplikat; raw body sendiri tidak disimpan. */
  bodyDigest: text('body_digest').notNull().default(''),
  headers: jsonb('headers').$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
  receivedAt: waktu('received_at').notNull().defaultNow(),
  processedAt: waktu('processed_at'),
  error: text('error')
}, t => [
  uniqueIndex('webhook_inbox_delivery_key').on(t.runtimeId, t.deliveryId),
  index('webhook_inbox_unprocessed_idx').on(t.processedAt)
])

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  detail: jsonb('detail').$type<Record<string, unknown> | null>(),
  ip: text('ip'),
  createdAt: waktu('created_at').notNull().defaultNow()
}, t => [index('audit_logs_org_created_idx').on(t.organizationId, t.createdAt)])

export type Organization = typeof organizations.$inferSelect
export type User = typeof users.$inferSelect
export type Membership = typeof organizationMemberships.$inferSelect
export type AiEmployee = typeof aiEmployees.$inferSelect
export type RuntimeInstance = typeof runtimeInstances.$inferSelect
export type Task = typeof tasks.$inferSelect
export type AgentRun = typeof agentRuns.$inferSelect
export type TaskEvent = typeof taskEvents.$inferSelect
export type Command = typeof commands.$inferSelect
export type Approval = typeof approvals.$inferSelect
