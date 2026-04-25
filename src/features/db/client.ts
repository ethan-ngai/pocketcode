/**
 * @file client.ts
 * @description Database access boundary consumed by SMS and REPL features.
 * @module db
 */
import type { ExecutionResult, ReplLanguage } from "../repl/repl.types";
import type { ExecutionJob, SmsIdentity, SmsMessage } from "./db.types";

/**
 * Input required to persist an SMS message.
 * @remarks The database implementation will map camelCase fields to the final
 * schema while callers stay independent of ORM naming conventions.
 */
export interface InsertSmsMessage {
  /** Inbound or outbound message direction. */
  direction: "inbound" | "outbound";
  /** Provider message SID for idempotency when available. */
  providerMessageSid: string | null;
  /** Phone number associated with the message. */
  phoneE164: string;
  /** User-visible body when present. */
  body: string | null;
  /** Provider status when present. */
  status: string | null;
  /** Raw provider payload retained for debugging and audits. */
  rawPayload: unknown;
}

/**
 * Input required to update a provider SMS delivery callback.
 * @remarks Status callbacks may arrive before or after local outbound
 * persistence, so provider SID remains the stable correlation key.
 */
export interface UpdateSmsStatusInput {
  /** Provider message SID reported by Twilio callbacks. */
  providerMessageSid: string;
  /** Delivery lifecycle value reported by the provider. */
  status: string;
  /** Raw provider callback retained for debugging and audits. */
  rawPayload: unknown;
}

/**
 * Input required to create a queued execution job.
 * @remarks SMS and admin callers share this shape so sandbox orchestration does
 * not need to know which user surface created the job.
 */
export interface CreateExecutionJobInput {
  /** Source SMS message id, if the job originated from SMS. */
  smsMessageId: string | null;
  /** SMS identity id that owns the execution context. */
  smsIdentityId: string | null;
  /** Runtime selected for execution. */
  language: ReplLanguage;
  /** Source code to execute. */
  code: string;
  /** Timeout budget captured at enqueue time. */
  timeoutMs: number;
  /** Output budget captured at enqueue time. */
  maxOutputChars: number;
}

/**
 * Active REPL session row used for future persistent-session work.
 * @remarks Phase 0 names the table and shape even though the MVP execution
 * model remains single-shot.
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
 * Database API promised to SMS, REPL, and admin workstreams.
 * @remarks Implementations can use Hyperdrive, Neon, and Drizzle details behind
 * this interface without forcing feature teams to coordinate on schema internals.
 */
export interface Db {
  /**
   * Finds or creates an SMS identity for a phone number.
   * @param phoneE164 - Sender phone number already normalized to E.164.
   * @returns Existing or newly created SMS identity.
   */
  findOrCreateSmsIdentity(phoneE164: string): Promise<SmsIdentity>;

  /**
   * Looks up a provider message by SID for idempotent webhook handling.
   * @param providerMessageSid - Twilio `MessageSid` or outbound `MessageStatus` callback SID.
   * @returns Stored message row when this provider event has already been seen.
   */
  findSmsMessageByProviderSid(providerMessageSid: string): Promise<SmsMessage | null>;

  /**
   * Persists a provider SMS event.
   * @param input - Normalized message payload from the SMS feature.
   * @returns Stored message row.
   */
  insertInboundSms(input: InsertSmsMessage): Promise<SmsMessage>;

  /**
   * Persists an outbound provider SMS event.
   * @param input - Normalized outbound message payload from the SMS feature.
   * @returns Stored outbound message row.
   */
  insertOutboundSms(input: InsertSmsMessage): Promise<SmsMessage>;

  /**
   * Updates delivery status for a provider message.
   * @param input - Provider callback fields keyed by message SID.
   * @returns Promise that resolves once the status callback is persisted.
   */
  updateSmsStatus(input: UpdateSmsStatusInput): Promise<void>;

  /**
   * Creates an execution job in the queued state.
   * @param input - Stable job creation data from SMS or admin surfaces.
   * @returns Stored execution job row.
   */
  createExecutionJob(input: CreateExecutionJobInput): Promise<ExecutionJob>;

  /**
   * Marks a queued job as running.
   * @param id - Execution job id.
   * @param sandboxId - Provider sandbox id when allocated.
   * @returns Promise that resolves once the transition is persisted.
   */
  markExecutionRunning(id: string, sandboxId?: string): Promise<void>;

  /**
   * Persists terminal execution state and output.
   * @param id - Execution job id.
   * @param result - Normalized sandbox result.
   * @returns Promise that resolves once lifecycle and output rows are persisted.
   */
  finishExecutionJob(id: string, result: ExecutionResult): Promise<void>;

  /**
   * Reads the active REPL session for an SMS identity.
   * @param identityId - SMS identity id.
   * @returns Active session or null when the user has no active state.
   */
  getActiveSession(identityId: string): Promise<ReplSession | null>;

  /**
   * Updates or creates the default session language for an SMS identity.
   * @param identityId - SMS identity id.
   * @param language - Language selected through SMS commands.
   * @returns Promise that resolves when the session state is persisted.
   */
  upsertSessionLanguage(identityId: string, language: ReplLanguage): Promise<void>;

  /**
   * Clears active session state for an SMS identity.
   * @param identityId - SMS identity id selected by the sender phone number.
   * @returns Promise that resolves once active state has been reset.
   */
  resetActiveSession(identityId: string): Promise<void>;
}
