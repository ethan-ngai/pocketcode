CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"actor_phone_e164" text,
	"event_type" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"sms_message_id" text,
	"sms_identity_id" text,
	"language" text NOT NULL,
	"code" text NOT NULL,
	"status" text NOT NULL,
	"timeout_ms" integer NOT NULL,
	"max_output_chars" integer NOT NULL,
	"sandbox_id" text,
	"exit_code" integer,
	"duration_ms" integer,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "execution_jobs_language_check" CHECK ("execution_jobs"."language" in ('python', 'java')),
	CONSTRAINT "execution_jobs_status_check" CHECK ("execution_jobs"."status" in ('queued', 'running', 'succeeded', 'failed', 'timed_out', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "execution_outputs" (
	"id" text PRIMARY KEY NOT NULL,
	"execution_job_id" text NOT NULL,
	"stdout" text DEFAULT '' NOT NULL,
	"stderr" text DEFAULT '' NOT NULL,
	"combined_preview" text DEFAULT '' NOT NULL,
	"was_truncated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repl_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"sms_identity_id" text NOT NULL,
	"language" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repl_sessions_language_check" CHECK ("repl_sessions"."language" in ('python', 'java'))
);
--> statement-breakpoint
CREATE TABLE "sms_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"phone_e164" text NOT NULL,
	"default_language" text DEFAULT 'python' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_identities_phone_e164_unique" UNIQUE("phone_e164")
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"direction" text NOT NULL,
	"provider" text DEFAULT 'sms8' NOT NULL,
	"provider_message_sid" text,
	"phone_e164" text NOT NULL,
	"body" text,
	"status" text,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_messages_provider_message_sid_unique" UNIQUE("provider_message_sid"),
	CONSTRAINT "sms_messages_direction_check" CHECK ("sms_messages"."direction" in ('inbound', 'outbound'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_jobs" ADD CONSTRAINT "execution_jobs_sms_message_id_sms_messages_id_fk" FOREIGN KEY ("sms_message_id") REFERENCES "public"."sms_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_jobs" ADD CONSTRAINT "execution_jobs_sms_identity_id_sms_identities_id_fk" FOREIGN KEY ("sms_identity_id") REFERENCES "public"."sms_identities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_outputs" ADD CONSTRAINT "execution_outputs_execution_job_id_execution_jobs_id_fk" FOREIGN KEY ("execution_job_id") REFERENCES "public"."execution_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repl_sessions" ADD CONSTRAINT "repl_sessions_sms_identity_id_sms_identities_id_fk" FOREIGN KEY ("sms_identity_id") REFERENCES "public"."sms_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_identities" ADD CONSTRAINT "sms_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "execution_jobs_identity_created_idx" ON "execution_jobs" USING btree ("sms_identity_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "repl_sessions_identity_active_idx" ON "repl_sessions" USING btree ("sms_identity_id","status","last_active_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "repl_sessions_one_active_identity_idx" ON "repl_sessions" USING btree ("sms_identity_id") WHERE "repl_sessions"."status" = 'active';--> statement-breakpoint
CREATE INDEX "sms_messages_phone_created_idx" ON "sms_messages" USING btree ("phone_e164","created_at" DESC NULLS LAST);