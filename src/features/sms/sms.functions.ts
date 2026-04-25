/**
 * @file sms.functions.ts
 * @description Server-side SMS workflow entrypoints used by route wrappers.
 * @module sms
 */
import { createPostgresDb, type Db } from "../db/client";
import type { ExecutionJob, SmsIdentity, SmsMessage } from "../db/db.types";
import { runExecutionJob } from "../repl/jobs";
import type { ExecutionResult, ReplLanguage, SmsCommand } from "../repl/repl.types";
import type { Env } from "../../shared/env";
import { isLikelyE164 } from "../../shared/validation";
import { hashLogValue, log, logger } from "../observability/logger";
import {
  DEFAULT_EXECUTION_MAX_OUTPUT_CHARS,
  DEFAULT_EXECUTION_TIMEOUT_MS,
} from "../security/quotas";
import { checkSmsExecutionRateLimit } from "../security/rate-limit";
import { parseSmsCommand } from "./parser";
import { createSmsWebhookResponse, formatExecutionSmsMessages, SMS_HELP_TEXT } from "./responder";
import { validateSms8Request } from "./signatures";
import type { InboundSmsMessage } from "./sms.types";
import { sendSms } from "./sms8";

/**
 * Cloudflare-compatible `waitUntil` callback used to finish SMS work after acknowledgement.
 * @remarks Tests can pass a collector while Workers pass `cloudflare:workers` waitUntil.
 */
export type WaitUntil = (promise: Promise<unknown>) => void;

/**
 * Dependencies SMS needs from adjacent workstreams.
 * @remarks Route files normally rely on Worker bindings, while tests can inject
 * in-memory fakes to verify parser, idempotency, and response behavior.
 */
export interface SmsDependencies {
  /** Database boundary for identities, messages, sessions, and execution jobs. */
  db?: Db;
  /** Execution runner owned by the REPL workstream. */
  runJob?: typeof runExecutionJob;
  /** Outbound SMS sender owned by the SMS8 provider boundary. */
  sendSms?: typeof sendSms;
}

/**
 * Normalized SMS8 webhook body before provider records are validated.
 * @remarks SMS8 can deliver callbacks as either form fields or JSON depending on
 * webhook configuration, so this shape preserves signature candidates for both.
 */
interface Sms8WebhookPayload {
  /** Canonical JSON array string used by the existing inbound normalizer. */
  messagesJson: string;
  /** Candidate strings that SMS8 may have signed for this callback shape. */
  signatureCandidates: readonly string[];
}

/**
 * JSON body accepted by the public demo allowlist form.
 * @remarks Keeping this deliberately narrow avoids letting the demo endpoint
 * become a general support console before auth and audit controls are added.
 */
interface DemoSmsAllowlistBody {
  /** E.164 phone number to enable for real SMS execution. */
  phoneE164?: unknown;
}

/**
 * Handles SMS8 inbound SMS webhooks.
 * @param request - Server route request containing SMS8's form webhook body.
 * @param env - Worker bindings for SMS8 credentials and execution policy.
 * @param waitUntil - Background task scheduler used to acknowledge SMS8 quickly.
 * @param dependencies - Optional test/runtime overrides for adjacent workstreams.
 * @returns Plain webhook acknowledgement once inbound messages are persisted.
 * @remarks SMS8 does not consume TwiML responses, so all user-visible replies
 * are sent through the SMS8 API while the webhook returns quickly.
 */
export async function handleSms8Inbound(
  request: Request,
  env: Env,
  waitUntil: WaitUntil = defaultWaitUntil,
  dependencies: SmsDependencies = {},
): Promise<Response> {
  try {
    const payload = await parseSms8WebhookPayload(request);

    if (!(await validateSms8Request(request, env, payload.signatureCandidates))) {
      logSms8SignatureFailure(request, payload.messagesJson);
      return new Response("Invalid SMS8 signature", { status: 403 });
    }

    const inboundMessages = normalizeInboundSmsMessages(payload.messagesJson);
    const db = resolveDb(env, dependencies);

    for (const inbound of inboundMessages) {
      await processInboundMessage({ inbound, db, dependencies, env, waitUntil });
    }

    return webhookResponse();
  } catch (error) {
    log("error", "SMS8 inbound webhook failed", { error: errorToLog(error) });
    return webhookResponse("Temporary SMS service error.", 500);
  }
}

/**
 * Enables a phone number for SMS execution from the demo page.
 * @param request - JSON request containing an E.164 `phoneE164` value.
 * @param env - Worker bindings used to reach the same SMS database as webhooks.
 * @param dependencies - Optional test overrides for the database boundary.
 * @returns JSON result consumed by the demo allowlist form.
 * @remarks This augments the static `SMS_ALLOWLIST` with a database-backed flag
 * because deployed Worker environment bindings cannot be mutated per request.
 */
export async function handleDemoSmsAllowlist(
  request: Request,
  env: Env,
  dependencies: Pick<SmsDependencies, "db"> = {},
): Promise<Response> {
  try {
    const body = (await request.json().catch(() => null)) as DemoSmsAllowlistBody | null;
    const validation = validateDemoSmsAllowlistBody(body);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const db = resolveDb(env, dependencies);
    const identity = await db.verifySmsIdentity(validation.phoneE164);

    return Response.json({
      allowed: true,
      phoneE164: identity.phoneE164,
    });
  } catch (error) {
    log("error", "Demo SMS allowlist update failed", { error: errorToLog(error) });
    return Response.json({ error: "Unable to update the SMS allowlist." }, { status: 500 });
  }
}

/**
 * Processes one normalized inbound SMS8 message.
 * @param input - Webhook context plus normalized provider payload.
 * @returns Promise that resolves after immediate persistence and scheduling.
 * @remarks SMS8 may batch messages in one webhook, so each message gets its own
 * idempotency check and background reply work.
 */
async function processInboundMessage(input: {
  inbound: InboundSmsMessage;
  db: Db;
  dependencies: SmsDependencies;
  env: Env;
  waitUntil: WaitUntil;
}): Promise<void> {
  logger.info("sms.inbound.received", {
    messageSid: input.inbound.providerMessageSid,
    phoneHash: hashLogValue(input.inbound.fromE164),
  });

  if (input.inbound.providerMessageSid) {
    const existing = await input.db.findSmsMessageByProviderSid(input.inbound.providerMessageSid);

    if (existing?.direction === "inbound") {
      return;
    }
  }

  const message = await input.db.insertInboundSms({
    direction: "inbound",
    providerMessageSid: input.inbound.providerMessageSid,
    phoneE164: input.inbound.fromE164,
    body: input.inbound.body,
    status: "received",
    rawPayload: input.inbound.rawPayload,
  });
  const identity = await input.db.findOrCreateSmsIdentity(input.inbound.fromE164);
  const access = checkSmsAllowlist(input.env, identity);
  const session = await input.db.getActiveSession(identity.id);
  const currentDefaultLanguage = session?.language ?? identity.defaultLanguage;
  const command = parseSmsCommand(input.inbound.body, currentDefaultLanguage);

  await dispatchInboundCommand({
    command,
    currentDefaultLanguage,
    db: input.db,
    dependencies: input.dependencies,
    env: input.env,
    access,
    identity,
    message,
    waitUntil: input.waitUntil,
  });
}

/**
 * Dispatches a parsed SMS command.
 * @param input - Parsed command plus persistence and provider dependencies.
 * @returns Promise that resolves once command side effects are scheduled.
 * @remarks Cheap commands still reply by SMS, but the webhook response remains
 * provider-neutral so SMS8 retries do not depend on user-facing copy.
 */
async function dispatchInboundCommand(input: {
  access: SmsAccessDecision;
  command: SmsCommand;
  currentDefaultLanguage: ReplLanguage;
  db: Db;
  dependencies: SmsDependencies;
  env: Env;
  identity: SmsIdentity;
  message: SmsMessage;
  waitUntil: WaitUntil;
}): Promise<void> {
  switch (input.command.kind) {
    case "help":
      input.waitUntil(sendReplySms({ ...input, body: SMS_HELP_TEXT, replyKind: "help" }));
      return;
    case "unknown":
      input.waitUntil(sendReplySms({ ...input, body: input.command.reason, replyKind: "unknown" }));
      return;
    case "reset":
      await input.db.resetActiveSession(input.identity.id);
      input.waitUntil(sendReplySms({ ...input, body: "Session reset.", replyKind: "reset" }));
      return;
    case "set_language":
      await input.db.upsertSessionLanguage(input.identity.id, input.command.language);
      input.waitUntil(
        sendReplySms({
          ...input,
          body: `Default language set to ${formatLanguage(input.command.language)}.`,
          replyKind: "set_language",
        }),
      );
      return;
    case "execute": {
      if (!input.access.allowed) {
        log("info", "SMS execution refused by allowlist", {
          phoneHash: hashLogValue(input.identity.phoneE164),
          reason: input.access.reason,
        });

        input.waitUntil(
          sendReplySms({ ...input, body: input.access.message, replyKind: "access_denied" }),
        );
        return;
      }

      const limitDecision = await checkSmsExecutionRateLimit(input.db, input.identity.phoneE164);

      if (!limitDecision.allowed) {
        log("info", "SMS execution refused by security policy", {
          phoneHash: hashLogValue(input.identity.phoneE164),
          reason: limitDecision.reason,
          retryAfterSeconds: limitDecision.retryAfterSeconds,
        });

        input.waitUntil(
          sendReplySms({
            ...input,
            body: limitDecision.message ?? "Execution limit reached.",
            replyKind: "rate_limited",
          }),
        );
        return;
      }

      const job = await input.db.createExecutionJob({
        smsMessageId: input.message.id,
        smsIdentityId: input.identity.id,
        language: input.command.language,
        code: input.command.code,
        timeoutMs: getExecutionTimeoutMs(input.env, input.command.language),
        maxOutputChars: parsePositiveInteger(
          input.env.EXECUTION_MAX_OUTPUT_CHARS,
          DEFAULT_EXECUTION_MAX_OUTPUT_CHARS,
        ),
      });

      await input.db.recordSessionExecution(
        input.identity.id,
        input.currentDefaultLanguage,
        job.id,
      );
      input.waitUntil(sendExecutionResultSms({ ...input, job }));
      return;
    }
  }
}

/**
 * Sends and persists a user-visible SMS reply.
 * @param input - Reply body plus workflow context captured from the inbound SMS.
 * @returns Promise that resolves once provider and DB persistence complete.
 * @remarks SMS8 lacks TwiML-style inline replies, so even cheap command responses
 * use the outbound API and are recorded in the same audit table as results.
 */
async function sendReplySms(input: {
  body: string;
  db: Db;
  dependencies: SmsDependencies;
  env: Env;
  identity: SmsIdentity;
  message: SmsMessage;
  replyKind: string;
}): Promise<void> {
  const send = input.dependencies.sendSms ?? sendSms;
  const sent = await send({
    to: input.identity.phoneE164,
    body: input.body,
    env: input.env,
  });

  await input.db.insertOutboundSms({
    direction: "outbound",
    providerMessageSid: sent.providerMessageSid,
    phoneE164: input.identity.phoneE164,
    body: input.body,
    status: "queued",
    rawPayload: { inboundMessageId: input.message.id, replyKind: input.replyKind },
  });
}

/**
 * Runs an execution job and sends final result chunks through SMS8.
 * @param input - Runtime context captured before the webhook response is returned.
 * @returns Promise that resolves once result delivery attempts are complete.
 */
async function sendExecutionResultSms(input: {
  db: Db;
  dependencies: SmsDependencies;
  env: Env;
  identity: SmsIdentity;
  job: ExecutionJob;
}): Promise<void> {
  const runJob = input.dependencies.runJob ?? runExecutionJob;
  const send = input.dependencies.sendSms ?? sendSms;
  let result: ExecutionResult;

  try {
    result = await runJob({
      job: input.job,
      identity: input.identity,
      db: input.db,
      env: input.env,
    });
  } catch (error) {
    log("error", "SMS execution job failed", {
      error: errorToLog(error),
      jobId: input.job.id,
    });
    result = {
      status: "failed",
      stdout: "",
      stderr: "Execution failed.",
      exitCode: null,
      durationMs: 0,
      errorCode: "SMS_EXECUTION_JOB_ERROR",
    };
  }

  for (const body of formatExecutionSmsMessages({ ...result, timeoutMs: input.job.timeoutMs })) {
    const sent = await send({
      to: input.identity.phoneE164,
      body,
      env: input.env,
    });

    await input.db.insertOutboundSms({
      direction: "outbound",
      providerMessageSid: sent.providerMessageSid,
      phoneE164: input.identity.phoneE164,
      body,
      status: "queued",
      rawPayload: { executionJobId: input.job.id },
    });
  }

  logger.info("execution.finished", {
    jobId: input.job.id,
    language: input.job.language,
    status: result.status,
    durationMs: result.durationMs,
    stdoutChars: result.stdout.length,
    stderrChars: result.stderr.length,
  });
}

/**
 * Parses an SMS8 webhook body without trusting provider-selected content type.
 * @param request - Webhook request carrying form-encoded or JSON SMS8 payloads.
 * @returns Normalized messages JSON plus signature validation candidates.
 * @remarks SMS8 has been observed sending JSON callbacks even when older docs
 * describe form fields, so the parser keeps both variants at the edge.
 */
async function parseSms8WebhookPayload(request: Request): Promise<Sms8WebhookPayload> {
  const rawBody = await request.text();
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    return parseSms8JsonWebhookPayload(rawBody);
  }

  const parsedBody = new URLSearchParams(rawBody);
  const messagesJson = requireFormValue(parsedBody, "messages");

  return {
    messagesJson,
    signatureCandidates: [messagesJson],
  };
}

/**
 * Parses SMS8's JSON webhook variant.
 * @param rawBody - Raw request body read once at the route boundary.
 * @returns Normalized messages JSON plus conservative signature candidates.
 * @remarks The full body candidate handles JSON webhooks that sign the whole
 * callback, while the compact messages candidate handles providers signing the
 * embedded `messages` value as they do for form callbacks.
 */
function parseSms8JsonWebhookPayload(rawBody: string): Sms8WebhookPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid SMS8 JSON payload");
  }

  const messages = readSms8JsonMessages(parsed);
  const messagesJson = typeof messages === "string" ? messages.trim() : JSON.stringify(messages);
  const rawMessagesJson = Array.isArray(parsed)
    ? rawBody.trim()
    : isSms8Message(parsed)
      ? rawBody.trim()
      : extractRawJsonPropertyValue(rawBody, "messages");

  if (!messagesJson) {
    throw new Error("Missing SMS8 messages field");
  }

  return {
    messagesJson,
    signatureCandidates: compactSignatureCandidates([messagesJson, rawMessagesJson, rawBody]),
  };
}

/**
 * Reads SMS8 message records from the JSON callback variants seen in production.
 * @param parsed - Parsed JSON body from the webhook request.
 * @returns Message collection or raw messages string ready for normalization.
 * @remarks SMS8 can post either a wrapper object, a message array, or a single
 * message object depending on webhook configuration.
 */
function readSms8JsonMessages(parsed: unknown): unknown {
  if (Array.isArray(parsed) || isSms8Message(parsed)) {
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  return readJsonObjectProperty(parsed, "messages");
}

/**
 * Extracts the exact JSON value text for a top-level property.
 * @param rawBody - Raw JSON request body supplied by SMS8.
 * @param key - Top-level property whose value may be signed by the provider.
 * @returns Raw JSON value substring, or null when it cannot be found safely.
 * @remarks SMS8's docs sign the raw `messages` field; preserving the original
 * substring avoids signature drift from JSON parse/stringify normalization.
 */
function extractRawJsonPropertyValue(rawBody: string, key: string): string | null {
  const keyPattern = new RegExp(`"${escapeRegExp(key)}"\\s*:`);
  const match = keyPattern.exec(rawBody);

  if (!match) {
    return null;
  }

  const valueStart = match.index + match[0].length;
  const firstNonWhitespaceOffset = rawBody.slice(valueStart).search(/\S/);

  if (firstNonWhitespaceOffset < 0) {
    return null;
  }

  const start = valueStart + firstNonWhitespaceOffset;
  const end = findJsonValueEnd(rawBody, start);

  return end === null ? null : rawBody.slice(start, end).trim();
}

/**
 * Finds the end index of a JSON value inside a larger object body.
 * @param rawBody - Full JSON text being scanned.
 * @param start - Index of the first non-whitespace character in the value.
 * @returns Exclusive end index, or null when the JSON fragment is malformed.
 */
function findJsonValueEnd(rawBody: string, start: number): number | null {
  const opener = rawBody[start];

  if (opener === '"' || opener === "[" || opener === "{") {
    return findStructuredJsonValueEnd(rawBody, start);
  }

  const delimiter = rawBody.slice(start).search(/[,}\]]/);
  return delimiter < 0 ? rawBody.length : start + delimiter;
}

/**
 * Scans string, array, or object JSON values while respecting quoted text.
 * @param rawBody - Full JSON text being scanned.
 * @param start - Index of the opening quote, bracket, or brace.
 * @returns Exclusive end index, or null when no matching close is found.
 */
function findStructuredJsonValueEnd(rawBody: string, start: number): number | null {
  const opener = rawBody[start];
  const stack = opener === '"' ? [] : [opener];
  let inString = opener === '"';
  let escaped = false;

  for (let index = start + 1; index < rawBody.length; index += 1) {
    const char = rawBody[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        if (stack.length === 0) {
          return index + 1;
        }

        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "[" || char === "{") {
      stack.push(char);
      continue;
    }

    if (char === "]" || char === "}") {
      const expected = char === "]" ? "[" : "{";

      if (stack.pop() !== expected) {
        return null;
      }

      if (stack.length === 0) {
        return index + 1;
      }
    }
  }

  return null;
}

/**
 * Removes empty and duplicate signature candidates while preserving order.
 * @param candidates - Potential provider-signed strings.
 * @returns Unique non-empty candidates for timing-safe comparison.
 */
function compactSignatureCandidates(candidates: Array<string | null>): readonly string[] {
  return Array.from(new Set(candidates.filter((candidate): candidate is string => Boolean(candidate))));
}

/**
 * Escapes a string for literal use inside a regular expression.
 * @param value - Text that should be matched exactly.
 * @returns Regex-safe literal text.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalizes required inbound SMS8 message records.
 * @param messagesJson - Raw JSON array from SMS8's `messages` form field.
 * @returns Provider-neutral inbound SMS messages.
 */
function normalizeInboundSmsMessages(messagesJson: string): InboundSmsMessage[] {
  let messages: unknown;

  try {
    messages = JSON.parse(messagesJson);
  } catch {
    throw new Error("Invalid SMS8 messages payload");
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("SMS8 messages payload must be a non-empty array");
  }

  return messages.map(normalizeInboundSmsMessage);
}

/**
 * Normalizes one SMS8 message record.
 * @param rawMessage - Parsed SMS8 message object from the webhook payload.
 * @returns Provider-neutral inbound SMS message.
 */
function normalizeInboundSmsMessage(rawMessage: unknown): InboundSmsMessage {
  if (!isSms8Message(rawMessage)) {
    throw new Error("Invalid SMS8 message record");
  }

  const fromE164 = rawMessage.number.trim();

  if (!isLikelyE164(fromE164)) {
    throw new Error("SMS8 number value must be E.164");
  }

  return {
    providerMessageSid:
      rawMessage.ID === undefined || rawMessage.ID === null ? null : String(rawMessage.ID),
    fromE164,
    to: null,
    body: rawMessage.message,
    rawPayload: rawMessage as Record<string, unknown>,
  };
}

/**
 * Checks whether a parsed value contains the SMS8 fields Pocketcode needs.
 * @param value - Parsed JSON value from the provider payload.
 * @returns True when the value can be normalized into an inbound SMS.
 */
function isSms8Message(value: unknown): value is {
  ID?: number | string | null;
  message: string;
  number: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "number" in value &&
    typeof value.number === "string" &&
    "message" in value &&
    typeof value.message === "string"
  );
}

/**
 * Requires a provider form field.
 * @param parsedBody - Parsed provider form body.
 * @param key - Field name documented by the provider.
 * @returns Non-empty form value.
 */
function requireFormValue(parsedBody: URLSearchParams, key: string): string {
  const value = parsedBody.get(key)?.trim();

  if (!value) {
    throw new Error(`Missing SMS8 ${key} field`);
  }

  return value;
}

/**
 * Reads one property from a parsed JSON object.
 * @param value - Parsed JSON payload from SMS8.
 * @param key - Provider field expected at the top level.
 * @returns Property value when the payload is object-like.
 */
function readJsonObjectProperty(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || !(key in value)) {
    throw new Error(`Missing SMS8 ${key} field`);
  }

  return (value as Record<string, unknown>)[key];
}

/**
 * Resolves the database dependency for SMS runtime work.
 * @param env - Worker bindings, optionally carrying a future DB implementation.
 * @param dependencies - Explicit dependency overrides from tests or adapters.
 * @returns Database boundary implementation.
 * @remarks Tests can inject an in-memory DB, while production routes build the
 * Postgres client from Hyperdrive first and direct DATABASE_URL only as fallback.
 */
function resolveDb(env: Env, dependencies: SmsDependencies): Db {
  const dbEnv = env as Env & { SMS_DB?: Db; DB?: Db };

  if (dependencies.db) {
    return dependencies.db;
  }

  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;

  if (connectionString) {
    return createPostgresDb({ connectionString });
  }

  const legacyCandidate = dbEnv.SMS_DB ?? dbEnv.DB;

  if (legacyCandidate) {
    return legacyCandidate;
  }

  throw new Error("SMS database client is not configured");
}

/**
 * Result of evaluating invite-only SMS execution access.
 * @remarks Cheap commands can still respond to users, but execution jobs must
 * fail closed for production pilot traffic when a phone is not enabled.
 */
type SmsAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: "missing_allowlist" | "not_allowlisted"; message: string };

/**
 * Checks whether a phone number may create execution jobs.
 * @param env - Worker bindings carrying the temporary pilot allowlist.
 * @param identity - Sender identity after provider normalization and persistence.
 * @returns Access decision for job creation.
 * @remarks Verified identities are the dynamic allowlist managed at runtime,
 * while `SMS_ALLOWLIST` remains the immutable deployment-level fallback.
 */
function checkSmsAllowlist(env: Env, identity: SmsIdentity): SmsAccessDecision {
  if (identity.isVerified) {
    return { allowed: true };
  }

  const rawAllowlist = env.SMS_ALLOWLIST?.trim();

  if (!rawAllowlist) {
    return env.ENVIRONMENT === "production"
      ? {
          allowed: false,
          reason: "missing_allowlist",
          message: "This SMS pilot is invite-only. Ask the project team for access.",
        }
      : { allowed: true };
  }

  const allowedPhones = new Set(
    rawAllowlist
      .split(",")
      .map((phone) => phone.trim())
      .filter(Boolean),
  );

  if (allowedPhones.has(identity.phoneE164)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "not_allowlisted",
    message: "This phone number is not enabled for the SMS pilot.",
  };
}

/**
 * Creates a plain webhook response with the expected content type.
 * @param message - Optional acknowledgement or diagnostic message.
 * @param status - HTTP status returned to SMS8.
 * @returns Response containing provider-neutral acknowledgement text.
 */
function webhookResponse(message?: string, status = 200): Response {
  return new Response(createSmsWebhookResponse(message), {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

/**
 * Converts a language enum into SMS copy.
 * @param language - Runtime selected by the sender.
 * @returns Capitalized language name.
 */
function formatLanguage(language: ReplLanguage): string {
  return language === "python" ? "Python" : "Java";
}

/**
 * Reads a positive integer env override.
 * @param value - Optional Worker binding value.
 * @param fallback - Default policy when no override is supplied.
 * @returns Parsed positive integer or the fallback.
 */
function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Validates the demo allowlist request body.
 * @param body - Parsed JSON payload from the browser.
 * @returns Normalized phone number or a form-safe error message.
 */
function validateDemoSmsAllowlistBody(
  body: DemoSmsAllowlistBody | null,
): { ok: true; phoneE164: string } | { ok: false; error: string } {
  const phoneE164 = body?.phoneE164;

  if (typeof phoneE164 !== "string" || !isLikelyE164(phoneE164.trim())) {
    return { ok: false, error: "Enter a phone number in E.164 format, like +15555550123." };
  }

  return { ok: true, phoneE164: phoneE164.trim() };
}

/**
 * Selects the per-language execution timeout for SMS jobs.
 * @param env - Worker bindings that may override the default execution budget.
 * @param language - Runtime selected by parser or user session state.
 * @returns Timeout in milliseconds captured on the execution job.
 * @remarks The environment override still wins while Java support is disabled.
 */
function getExecutionTimeoutMs(env: Env, _language: ReplLanguage): number {
  return parsePositiveInteger(env.EXECUTION_TIMEOUT_MS, DEFAULT_EXECUTION_TIMEOUT_MS);
}

/**
 * Fire-and-forget fallback used outside Cloudflare request contexts.
 * @param promise - Background promise to observe for unhandled failures.
 */
function defaultWaitUntil(promise: Promise<unknown>): void {
  promise.catch((error) => {
    log("error", "Background SMS task failed", { error: errorToLog(error) });
  });
}

/**
 * Logs a rejected SMS8 webhook without persisting provider body content.
 * @param request - Request that failed signature validation.
 * @param parsedBody - Parsed form used only for low-cardinality metadata.
 * @remarks Forged webhooks are expected during probing, so the log keeps enough
 * context for triage without storing SMS text or raw payloads.
 */
function logSms8SignatureFailure(request: Request, messagesJson: string): void {
  log("warn", "Rejected SMS8 webhook signature", {
    path: new URL(request.url).pathname,
    hasSignature:
      request.headers.has("x-sg-signature") || request.headers.has("http_x_sg_signature"),
    messagesHash: hashLogValue(messagesJson),
  });
}

/**
 * Converts unknown errors into structured log metadata.
 * @param error - Unknown exception from webhook or background processing.
 * @returns Log-safe error shape.
 */
function errorToLog(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { value: error };
}
