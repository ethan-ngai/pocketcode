/**
 * @file db.types.ts
 * @description Stable database-facing row contracts for parallel feature work.
 * @module db
 */
import type { ExecutionStatus, ReplLanguage } from "../repl/repl.types";
import type { SmsDirection, SmsProvider } from "../sms/sms.types";

/**
 * SMS identity row shared by database, SMS, and admin features.
 * @remarks This mirrors the planned `sms_identities` table without exposing ORM
 * internals before the migration workstream chooses the final data layer.
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
 * Execution job row shared by REPL, SMS, and admin features.
 * @remarks These fields represent the lifecycle contract, not a final ORM model.
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
