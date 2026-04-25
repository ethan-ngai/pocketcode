/**
 * @file db.types.ts
 * @description Stable database-facing row and mutation contracts.
 * @module db
 */
import type { ExecutionStatus, ReplLanguage } from "../repl/repl.types";
import type { SmsDirection, SmsProvider } from "../sms/sms.types";
import type {
  auditEvents,
  executionJobs,
  executionOutputs,
  replSessions,
  smsIdentities,
  smsMessages,
  users,
} from "./schema";

/**
 * User row selected from the app-level users table.
 * @remarks Exporting the Drizzle-facing row type lets auth and admin code share
 * one database concept while Better Auth integration is finalized.
 */
export type UserRow = typeof users.$inferSelect;

/**
 * User insert payload accepted by the app-level users table.
 * @remarks Keeping insert types here prevents feature folders from importing
 * migration or table internals just to seed or test records.
 */
export type InsertUser = typeof users.$inferInsert;

/**
 * SMS identity row shared by database, SMS, and admin features.
 * @remarks This interface narrows database text checks into domain unions that
 * callers already use at parser and execution boundaries.
 */
export interface SmsIdentity {
  /** Primary key. */
  id: string;
  /** Linked Better Auth user id, if one exists. */
  userId: string | null;
  /** Unique sender phone number in E.164 format. */
  phoneE164: string;
  /** Default language used when SMS code has no explicit prefix. */
  defaultLanguage: ReplLanguage;
  /** Whether the phone identity has completed verification. */
  isVerified: boolean;
  /** Creation timestamp. */
  createdAt: Date;
  /** Last update timestamp. */
  updatedAt: Date;
}

/**
 * SMS identity insert payload.
 * @remarks Tests and seed scripts use the ORM shape while application callers
 * stay behind the higher-level `Db` methods.
 */
export type InsertSmsIdentity = typeof smsIdentities.$inferInsert;

/**
 * SMS message row shared by ingress, egress, and admin views.
 * @remarks Provider payloads remain opaque here so Twilio-specific details stay
 * in the SMS feature.
 */
export interface SmsMessage {
  /** Primary key. */
  id: string;
  /** Inbound or outbound message direction. */
  direction: SmsDirection;
  /** SMS provider that produced or sent the message. */
  provider: SmsProvider;
  /** Provider message SID used for idempotency and callbacks. */
  providerMessageSid: string | null;
  /** Phone number associated with the message. */
  phoneE164: string;
  /** Message body, when available from provider payloads. */
  body: string | null;
  /** Provider delivery or processing status. */
  status: string | null;
  /** Provider payload retained for audits. */
  rawPayload: unknown;
  /** Creation timestamp. */
  createdAt: Date;
}

/**
 * SMS message insert payload.
 * @remarks The access layer translates public camelCase inputs into this ORM
 * shape so Twilio retry handling remains centralized.
 */
export type InsertSmsMessageRow = typeof smsMessages.$inferInsert;

/**
 * Active REPL session row used for persistent language and state.
 * @remarks The session contract is kept with DB types because SMS and REPL code
 * should not import Drizzle table definitions for ordinary reads.
 */
export interface ReplSession {
  /** Primary key. */
  id: string;
  /** Owning SMS identity. */
  smsIdentityId: string;
  /** Session language. */
  language: ReplLanguage;
  /** Session lifecycle status. */
  status: string;
  /** Provider-neutral state payload reserved for later REPL persistence. */
  state: unknown;
  /** Last activity timestamp. */
  lastActiveAt: Date;
  /** Creation timestamp. */
  createdAt: Date;
}

/**
 * REPL session insert payload.
 * @remarks Seed and integration tests can build rows without depending on raw
 * migration SQL.
 */
export type InsertReplSession = typeof replSessions.$inferInsert;

/**
 * Execution job row shared by REPL, SMS, and admin features.
 * @remarks These fields represent the lifecycle contract rather than exposing
 * the table object used by Drizzle queries.
 */
export interface ExecutionJob {
  /** Primary key. */
  id: string;
  /** Source inbound SMS message when the job came from SMS. */
  smsMessageId: string | null;
  /** SMS identity that owns the job. */
  smsIdentityId: string | null;
  /** Language runtime used for execution. */
  language: ReplLanguage;
  /** Source code submitted for execution. */
  code: string;
  /** Current lifecycle status. */
  status: ExecutionStatus;
  /** Timeout budget used for this job. */
  timeoutMs: number;
  /** Output budget used for this job. */
  maxOutputChars: number;
  /** Sandbox id reported by Cloudflare Sandbox. */
  sandboxId: string | null;
  /** Process exit code when available. */
  exitCode: number | null;
  /** Runtime duration in milliseconds. */
  durationMs: number | null;
  /** Machine-readable error code when execution fails. */
  errorCode: string | null;
  /** Creation timestamp. */
  createdAt: Date;
  /** Start timestamp. */
  startedAt: Date | null;
  /** Terminal timestamp. */
  finishedAt: Date | null;
}

/**
 * Aggregated SMS identity usage shown on admin pages.
 * @remarks This keeps dashboard metrics behind the DB feature instead of making
 * admin components know how execution jobs join to phone identities.
 */
export interface SmsIdentityUsage {
  /** SMS identity primary key. */
  id: string;
  /** Phone number associated with the identity. */
  phoneE164: string;
  /** Runtime used for prefix-free SMS commands. */
  defaultLanguage: ReplLanguage;
  /** Number of execution jobs owned by this identity. */
  executionCount: number;
  /** Most recent session activity when available. */
  lastActiveAt: Date | null;
}

/**
 * Execution job insert payload.
 * @remarks Job writers should prefer `Db.createExecutionJob`, while tests may
 * need the precise ORM insert type for direct setup.
 */
export type InsertExecutionJob = typeof executionJobs.$inferInsert;

/**
 * Execution output row selected from Postgres.
 * @remarks Output is separated from jobs so admin screens can opt into the
 * larger stream payload only when needed.
 */
export type ExecutionOutputRow = typeof executionOutputs.$inferSelect;

/**
 * Execution output insert payload.
 * @remarks Terminal job writes use this shape inside the transaction that also
 * advances the execution lifecycle.
 */
export type InsertExecutionOutput = typeof executionOutputs.$inferInsert;

/**
 * Audit event row selected from Postgres.
 * @remarks Audit consumers should treat metadata as opaque JSON owned by the
 * event producer.
 */
export type AuditEventRow = typeof auditEvents.$inferSelect;

/**
 * Audit event insert payload.
 * @remarks The shape stays exported for admin and security workstreams that
 * append events without owning schema internals.
 */
export type InsertAuditEvent = typeof auditEvents.$inferInsert;
