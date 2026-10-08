CREATE TYPE "public"."command_type" AS ENUM('ASSIGN_TASK', 'REQUEST_STATUS', 'REQUEST_CANCEL', 'SUBMIT_APPROVAL');--> statement-breakpoint
CREATE TYPE "public"."run_kind" AS ENUM('main', 'subagent');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'manager', 'member', 'approver', 'auditor');--> statement-breakpoint
CREATE TYPE "public"."command_state" AS ENUM('CREATED', 'QUEUED', 'DISPATCHING', 'ACCEPTED', 'RUNNING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'CANCEL_REQUESTED', 'CANCELLED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'denied', 'expired', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'waiting_for_approval', 'stopping', 'completed', 'failed', 'cancelled', 'interrupted', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."runtime_status" AS ENUM('unknown', 'online', 'offline');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('CREATED', 'QUEUED', 'ASSIGNED', 'RUNNING', 'WAITING_APPROVAL', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCEL_REQUESTED', 'CANCELLED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."event_source" AS ENUM('webhook', 'poll', 'command', 'system');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid,
	"employee_id" uuid,
	"runtime_id" uuid,
	"parent_run_id" uuid,
	"kind" "run_kind" DEFAULT 'main' NOT NULL,
	"hermes_run_id" text,
	"hermes_session_id" text,
	"hermes_subagent_id" text,
	"delegation_id" text,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"output" text,
	"usage" jsonb,
	"runtime_info" jsonb,
	"last_error" text,
	"last_polled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"job_title" text NOT NULL,
	"department" text DEFAULT 'Umum' NOT NULL,
	"specialization" text,
	"sop" text,
	"allowed_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_supervisor" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid,
	"run_id" uuid,
	"hermes_request_id" text,
	"command" text NOT NULL,
	"description" text,
	"risk_class" text DEFAULT 'external_mutation' NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"choice" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"detail" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid,
	"run_id" uuid,
	"type" "command_type" NOT NULL,
	"state" "command_state" DEFAULT 'CREATED' NOT NULL,
	"idempotency_key" text NOT NULL,
	"correlation_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"last_error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"locked_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runtime_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"secret_enc" text NOT NULL,
	"masked_preview" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text DEFAULT 'utama' NOT NULL,
	"base_url" text NOT NULL,
	"webhook_key_hash" text NOT NULL,
	"capabilities" jsonb,
	"hermes_version" text,
	"status" "runtime_status" DEFAULT 'unknown' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid,
	"run_id" uuid,
	"runtime_id" uuid,
	"event_id" text NOT NULL,
	"source" "event_source" NOT NULL,
	"source_event_type" text NOT NULL,
	"hermes_session_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_version" text DEFAULT 'hermes.observer.v1' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid,
	"created_by" uuid,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"objective" text NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"status" "task_status" DEFAULT 'CREATED' NOT NULL,
	"deadline_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"output_summary" text,
	"last_error" text,
	"terminal_evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runtime_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"delivery_id" text NOT NULL,
	"event_name" text NOT NULL,
	"signature_ok" boolean NOT NULL,
	"raw_body" text NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_runtime_id_runtime_instances_id_fk" FOREIGN KEY ("runtime_id") REFERENCES "public"."runtime_instances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_employees" ADD CONSTRAINT "ai_employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_credentials" ADD CONSTRAINT "runtime_credentials_runtime_id_runtime_instances_id_fk" FOREIGN KEY ("runtime_id") REFERENCES "public"."runtime_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_credentials" ADD CONSTRAINT "runtime_credentials_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_instances" ADD CONSTRAINT "runtime_instances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_runtime_id_runtime_instances_id_fk" FOREIGN KEY ("runtime_id") REFERENCES "public"."runtime_instances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_inbox" ADD CONSTRAINT "webhook_inbox_runtime_id_runtime_instances_id_fk" FOREIGN KEY ("runtime_id") REFERENCES "public"."runtime_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_inbox" ADD CONSTRAINT "webhook_inbox_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_hermes_run_key" ON "agent_runs" USING btree ("organization_id","hermes_run_id");--> statement-breakpoint
CREATE INDEX "agent_runs_session_idx" ON "agent_runs" USING btree ("organization_id","hermes_session_id");--> statement-breakpoint
CREATE INDEX "agent_runs_task_idx" ON "agent_runs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "agent_runs_status_idx" ON "agent_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_employees_org_idx" ON "ai_employees" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "approvals_org_status_idx" ON "approvals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "audit_logs_org_created_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "commands_idempotency_key" ON "commands" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "commands_state_next_idx" ON "commands" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "commands_org_created_idx" ON "commands" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "org_memberships_org_user_key" ON "organization_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "org_memberships_user_idx" ON "organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "runtime_credentials_key" ON "runtime_credentials" USING btree ("runtime_id","field_key");--> statement-breakpoint
CREATE UNIQUE INDEX "runtime_instances_org_key" ON "runtime_instances" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "runtime_instances_webhook_key" ON "runtime_instances" USING btree ("webhook_key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "task_events_event_id_key" ON "task_events" USING btree ("organization_id","event_id");--> statement-breakpoint
CREATE INDEX "task_events_task_idx" ON "task_events" USING btree ("task_id","occurred_at");--> statement-breakpoint
CREATE INDEX "task_events_org_received_idx" ON "task_events" USING btree ("organization_id","received_at");--> statement-breakpoint
CREATE INDEX "tasks_org_status_idx" ON "tasks" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "tasks_org_created_idx" ON "tasks" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_inbox_delivery_key" ON "webhook_inbox" USING btree ("runtime_id","delivery_id");--> statement-breakpoint
CREATE INDEX "webhook_inbox_unprocessed_idx" ON "webhook_inbox" USING btree ("processed_at");