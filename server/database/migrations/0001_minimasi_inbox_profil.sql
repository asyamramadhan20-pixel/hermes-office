ALTER TYPE "public"."run_kind" ADD VALUE 'external';--> statement-breakpoint
ALTER TABLE "ai_employees" ADD COLUMN "hermes_profile" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "origin" text DEFAULT 'dashboard' NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_inbox" ADD COLUMN "body" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_inbox" ADD COLUMN "body_digest" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_employees_org_profile_key" ON "ai_employees" USING btree ("organization_id","hermes_profile");--> statement-breakpoint
ALTER TABLE "webhook_inbox" DROP COLUMN "raw_body";--> statement-breakpoint
-- Bersihkan pratinjau argumen tool yang pernah tersimpan di event (minimasi data: cukup nama tool).
UPDATE "task_events" SET "data" = "data" - 'toolInputPreview' WHERE "data" ? 'toolInputPreview';
