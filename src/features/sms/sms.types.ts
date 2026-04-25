/**
 * @file sms.types.ts
 * @description Shared SMS contracts for Twilio ingress, egress, and parsing.
 * @module sms
 */
import type { SmsCommand } from "../repl/repl.types";

/**
 * Maximum executable source accepted after removing an SMS command prefix.
 * @remarks Twilio may deliver longer bodies, but this limit keeps the first MVP
 * aligned with the sandbox timeout and abuse-control assumptions.
 */
export const SMS_MAX_SOURCE_CHARS = 2_000;

/**
 * Maximum characters placed in one outbound SMS chunk.
 * @remarks The budget stays below carrier segmentation limits to leave room for
 * truncation copy and provider-specific encoding differences.
 */
export const SMS_OUTPUT_CHUNK_CHARS = 1_400;

/**
 * Direction values stored for SMS provider events.
 * @remarks These values intentionally match the database check constraint.
 */
export type SmsDirection = "inbound" | "outbound";

/**
 * Provider names currently understood by the SMS feature boundary.
 * @remarks Keeping this narrow lets non-Twilio support be added deliberately.
 */
export type SmsProvider = "twilio";

/**
 * Normalized inbound message used before provider payload persistence.
 * @remarks The raw payload is retained so signature and delivery edge cases can
 * be debugged without coupling every caller to Twilio's field names.
 */
export interface InboundSmsMessage {
  /** Provider message identifier used for idempotency when available. */
  providerMessageSid: string | null;
  /** Sender phone number normalized to E.164 by the provider layer. */
  fromE164: string;
  /** Destination number or messaging service address that received the SMS. */
  to: string | null;
  /** User-visible SMS body before command parsing. */
  body: string;
  /** Provider-specific webhook form fields kept for audits. */
  rawPayload: Record<string, unknown>;
}

/**
 * Parsed inbound command plus the message metadata needed by the SMS workflow.
 * @remarks This keeps route handlers free of parser details and gives database
 * work a single stable input shape to consume.
 */
export interface ParsedInboundSms {
  /** Normalized provider message details. */
  message: InboundSmsMessage;
  /** Command produced from the SMS body and sender defaults. */
  command: SmsCommand;
}

/**
 * Outbound SMS request handed to the provider client.
 * @remarks The provider layer decides whether to use a messaging service or a
 * concrete sender number based on environment configuration.
 */
export interface OutboundSmsRequest {
  /** E.164 destination phone number. */
  toE164: string;
  /** SMS body already chunked according to the output policy. */
  body: string;
  /** Optional execution or message id for provider callback correlation. */
  correlationId?: string;
}
