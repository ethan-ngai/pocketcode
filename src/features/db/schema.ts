/**
 * @file schema.ts
 * @description Drizzle schema for the durable SMS REPL data model.
 * @module db
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Shared timestamp column options.
 * @remarks Postgres owns timestamp defaults so Worker retries and direct SQL
 * maintenance scripts do not need to agree on application clock behavior.
 */
const timestampTz = { withTimezone: true, mode: "date" } as const;

/**
 * Better Auth-compatible application users.
 * @remarks This table keeps the common app fields until the auth workstream
 * maps Better Auth's generated schema onto the same user concept.
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", timestampTz).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", timestampTz).notNull().defaultNow(),
});

/**
 * Better Auth browser session records.
 * @remarks SMS identities do not depend on these rows; sessions represent only
 * web/admin authentication and can expire independently of phone usage.
 */
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", timestampTz).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", timestampTz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", timestampTz).notNull().defaultNow(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

/**
 * Better Auth credential and OAuth account links.
 * @remarks Provider accounts are separate from SMS identities so phone-only
 * usage stays available without public web signup.
 */
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", timestampTz),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", timestampTz),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at", timestampTz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", timestampTz).notNull().defaultNow(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_idx").on(table.providerId, table.accountId),
  ],
);

/**
 * Better Auth one-time verification values.
 * @remarks Keeping verification values in Postgres avoids adding a second auth
 * store before magic links or SMS account linking need specialized storage.
 */
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", timestampTz).notNull(),
    createdAt: timestamp("created_at", timestampTz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", timestampTz).notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/**
 * Phone-number identity used before and after Better Auth account linkage.
 * @remarks SMS users must be durable even when no web account exists, so the
 * auth relationship is nullable and deletes preserve execution history.
 */
export const smsIdentities = pgTable("sms_identities", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  phoneE164: text("phone_e164").notNull().unique(),
  defaultLanguage: text("default_language").notNull().default("python"),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at", timestampTz).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", timestampTz).notNull().defaultNow(),
});

/**
 * Per-phone execution quota overrides and abuse blocks.
 * @remarks Quotas are keyed by phone number rather than identity id so support
 * actions continue to apply if an identity row is recreated during recovery.
 */
export const smsQuotas = pgTable("sms_quotas", {
  phoneE164: text("phone_e164").primaryKey(),
  hourlyLimit: integer("hourly_limit").notNull().default(20),
  dailyLimit: integer("daily_limit").notNull().default(100),
  disabled: boolean("disabled").notNull().default(false),
  reason: text("reason"),
  updatedAt: timestamp("updated_at", timestampTz).notNull().defaultNow(),
});

/**
 * Provider SMS event log.
 * @remarks Twilio callbacks may be retried, so provider SID uniqueness gives
 * ingress code an idempotent persistence boundary.
 */
export const smsMessages = pgTable(
  "sms_messages",
  {
    id: text("id").primaryKey(),
    direction: text("direction").notNull(),
    provider: text("provider").notNull().default("twilio"),
    providerMessageSid: text("provider_message_sid").unique(),
    phoneE164: text("phone_e164").notNull(),
    body: text("body"),
    status: text("status"),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", timestampTz).notNull().defaultNow(),
  },
  (table) => [
    check("sms_messages_direction_check", sql`${table.direction} in ('inbound', 'outbound')`),
    index("sms_messages_phone_created_idx").on(table.phoneE164, table.createdAt.desc()),
  ],
);

/**
 * Per-phone REPL session state.
 * @remarks MVP execution is single-shot, but keeping one active row per
 * identity gives language preference changes a stable home.
 */
export const replSessions = pgTable(
  "repl_sessions",
  {
    id: text("id").primaryKey(),
    smsIdentityId: text("sms_identity_id")
      .notNull()
      .references(() => smsIdentities.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    status: text("status").notNull().default("active"),
    state: jsonb("state").notNull().default({}),
    lastActiveAt: timestamp("last_active_at", timestampTz).notNull().defaultNow(),
    createdAt: timestamp("created_at", timestampTz).notNull().defaultNow(),
  },
  (table) => [
    check("repl_sessions_language_check", sql`${table.language} in ('python', 'java')`),
    index("repl_sessions_identity_active_idx").on(
      table.smsIdentityId,
      table.status,
      table.lastActiveAt.desc(),
    ),
    uniqueIndex("repl_sessions_one_active_identity_idx")
      .on(table.smsIdentityId)
      .where(sql`${table.status} = 'active'`),
  ],
);

/**
 * Sandbox execution lifecycle record.
 * @remarks Jobs are written before sandbox dispatch so retries and admin
 * inspection can reason about queued work independently from Twilio delivery.
 */
export const executionJobs = pgTable(
  "execution_jobs",
  {
    id: text("id").primaryKey(),
    smsMessageId: text("sms_message_id").references(() => smsMessages.id, { onDelete: "set null" }),
    smsIdentityId: text("sms_identity_id").references(() => smsIdentities.id, {
      onDelete: "set null",
    }),
    language: text("language").notNull(),
    code: text("code").notNull(),
    status: text("status").notNull(),
    timeoutMs: integer("timeout_ms").notNull(),
    maxOutputChars: integer("max_output_chars").notNull(),
    sandboxId: text("sandbox_id"),
    exitCode: integer("exit_code"),
    durationMs: integer("duration_ms"),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", timestampTz).notNull().defaultNow(),
    startedAt: timestamp("started_at", timestampTz),
    finishedAt: timestamp("finished_at", timestampTz),
  },
  (table) => [
    check("execution_jobs_language_check", sql`${table.language} in ('python', 'java')`),
    check(
      "execution_jobs_status_check",
      sql`${table.status} in ('queued', 'running', 'succeeded', 'failed', 'timed_out', 'rejected')`,
    ),
    index("execution_jobs_identity_created_idx").on(table.smsIdentityId, table.createdAt.desc()),
  ],
);

/**
 * Lossless execution output streams and SMS preview text.
 * @remarks Output is split from jobs to keep lifecycle queries small while
 * preserving full stdout and stderr for admin inspection.
 */
export const executionOutputs = pgTable("execution_outputs", {
  id: text("id").primaryKey(),
  executionJobId: text("execution_job_id")
    .notNull()
    .references(() => executionJobs.id, { onDelete: "cascade" }),
  stdout: text("stdout").notNull().default(""),
  stderr: text("stderr").notNull().default(""),
  combinedPreview: text("combined_preview").notNull().default(""),
  wasTruncated: boolean("was_truncated").notNull().default(false),
  createdAt: timestamp("created_at", timestampTz).notNull().defaultNow(),
});

/**
 * Append-only administrative and system audit events.
 * @remarks Actor fields support both web admins and SMS-only users without
 * forcing phone identities into the Better Auth user table.
 */
export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorPhoneE164: text("actor_phone_e164"),
  eventType: text("event_type").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", timestampTz).notNull().defaultNow(),
});

/**
 * Planned table names from the common contract.
 * @remarks This list is retained for route and admin workstreams that need a
 * lightweight contract without importing Drizzle table objects.
 */
export const TABLE_NAMES = [
  "users",
  "session",
  "account",
  "verification",
  "sms_identities",
  "sms_quotas",
  "sms_messages",
  "execution_jobs",
  "execution_outputs",
  "repl_sessions",
  "audit_events",
] as const;
