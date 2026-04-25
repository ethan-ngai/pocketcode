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
  DEFAULT_JAVA_EXECUTION_TIMEOUT_MS,
} from "../security/quotas";
import { checkSmsExecutionRateLimit } from "../security/rate-limit";
import { parseSmsCommand } from "./parser";
import { createTwiMlResponse, formatExecutionSmsMessages, SMS_HELP_TEXT } from "./responder";
import { validateTwilioRequest } from "./signatures";
import type { InboundSmsMessage } from "./sms.types";
import { sendSms } from "./twilio";

/**
 * Cloudflare-compatible `waitUntil` callback used to finish execution after TwiML.
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
  /** Outbound SMS sender owned by the Twilio provider boundary. */
  sendSms?: typeof sendSms;
}

/**
 * Handles Twilio inbound SMS webhooks.
 * @param request - Server route request containing Twilio's form webhook body.
 * @param env - Worker bindings for Twilio credentials and execution policy.
 * @param waitUntil - Background task scheduler used to return TwiML quickly.
 * @param dependencies - Optional test/runtime overrides for adjacent workstreams.
 * @returns TwiML response for inbound webhooks.
 * @remarks Execution commands intentionally return before sandbox completion and
 * send their final result later through Twilio REST.
 */
export async function handleTwilioInbound(
  request: Request,
  env: Env,
  waitUntil: WaitUntil = defaultWaitUntil,
  dependencies: SmsDependencies = {},
): Promise<Response> {
  try {
    const parsedBody = await parseWebhookForm(request);

    if (!(await validateTwilioRequest(request, env, parsedBody))) {
      logTwilioSignatureFailure(request, parsedBody);
      return new Response("Invalid Twilio signature", { status: 403 });
    }

    const inbound = normalizeInboundSms(parsedBody);
    const db = resolveDb(env, dependencies);

    logger.info("sms.inbound.received", {
      messageSid: inbound.providerMessageSid,
      phoneHash: hashLogValue(inbound.fromE164),
    });

    if (inbound.providerMessageSid) {
      const existing = await db.findSmsMessageByProviderSid(inbound.providerMessageSid);

      if (existing?.direction === "inbound") {
        return twimlResponse();
      }
    }

    const message = await db.insertInboundSms({
      direction: "inbound",
      providerMessageSid: inbound.providerMessageSid,
      phoneE164: inbound.fromE164,
      body: inbound.body,
      status: "received",
      rawPayload: inbound.rawPayload,
    });
    const identity = await db.findOrCreateSmsIdentity(inbound.fromE164);
    const access = checkSmsAllowlist(env, identity.phoneE164);
    const session = await db.getActiveSession(identity.id);
    const currentDefaultLanguage = session?.language ?? identity.defaultLanguage;
    const command = parseSmsCommand(inbound.body, currentDefaultLanguage);

    return await dispatchInboundCommand({
      command,
      currentDefaultLanguage,
      db,
      dependencies,
      env,
      access,
      identity,
      message,
      waitUntil,
    });
  } catch (error) {
    log("error", "Twilio inbound webhook failed", { error: errorToLog(error) });
    return twimlResponse("Temporary SMS service error.", 500);
  }
}

/**
 * Handles Twilio outbound delivery status callbacks.
 * @param request - Server route request containing Twilio's status form body.
 * @param env - Worker bindings for signature validation and future DB access.
 * @param dependencies - Optional test/runtime overrides for adjacent workstreams.
 * @returns Empty response when the callback has been accepted.
 * @remarks Status callbacks should never trigger execution; they only update the
 * provider event row associated with an outbound message SID.
 */
export async function handleTwilioStatus(
  request: Request,
  env: Env,
  dependencies: SmsDependencies = {},
): Promise<Response> {
  try {
    const parsedBody = await parseWebhookForm(request);

    if (!(await validateTwilioRequest(request, env, parsedBody))) {
      logTwilioSignatureFailure(request, parsedBody);
      return new Response("Invalid Twilio signature", { status: 403 });
    }

    const providerMessageSid = requireFormValue(parsedBody, "MessageSid");
    const status =
      parsedBody.get("MessageStatus") ?? parsedBody.get("SmsStatus") ?? parsedBody.get("Status");

    if (!status) {
      return new Response("Missing status", { status: 400 });
    }

    await resolveDb(env, dependencies).updateSmsStatus({
      providerMessageSid,
      status,
      rawPayload: formToPayload(parsedBody),
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    log("error", "Twilio status webhook failed", { error: errorToLog(error) });
    return new Response("Status callback failed", { status: 500 });
  }
}

/**
 * Dispatches a parsed SMS command.
 * @param input - Parsed command plus persistence and provider dependencies.
 * @returns Immediate TwiML response for Twilio.
 * @remarks Cheap commands complete inline, while execution is scheduled in the
 * request context to keep Twilio retry behavior predictable.
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
}): Promise<Response> {
  switch (input.command.kind) {
    case "help":
      return twimlResponse(SMS_HELP_TEXT);
    case "unknown":
      return twimlResponse(input.command.reason);
    case "reset":
      await input.db.resetActiveSession(input.identity.id);
      return twimlResponse("Session reset.");
    case "set_language":
      await input.db.upsertSessionLanguage(input.identity.id, input.command.language);
      return twimlResponse(`Default language set to ${formatLanguage(input.command.language)}.`);
    case "execute": {
      if (!input.access.allowed) {
        log("info", "SMS execution refused by allowlist", {
          phoneHash: hashLogValue(input.identity.phoneE164),
          reason: input.access.reason,
        });

        return twimlResponse(input.access.message);
      }

      const limitDecision = await checkSmsExecutionRateLimit(input.db, input.identity.phoneE164);

      if (!limitDecision.allowed) {
        log("info", "SMS execution refused by security policy", {
          phoneHash: hashLogValue(input.identity.phoneE164),
          reason: limitDecision.reason,
          retryAfterSeconds: limitDecision.retryAfterSeconds,
        });

        return twimlResponse(limitDecision.message ?? "Execution limit reached.");
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
      return twimlResponse("Running code...");
    }
  }
}

/**
 * Runs an execution job and sends final result chunks through Twilio.
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
      statusCallbackUrl: getStatusCallbackUrl(input.env),
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
 * Parses a Twilio form body without trusting any field values.
 * @param request - Webhook request with an x-www-form-urlencoded body.
 * @returns Parsed form parameters.
 * @remarks Reading text keeps signature validation aligned with Twilio's
 * form-encoded webhook contract and avoids multipart buffering surprises.
 */
async function parseWebhookForm(request: Request): Promise<URLSearchParams> {
  return new URLSearchParams(await request.text());
}

/**
 * Normalizes required inbound Twilio fields.
 * @param parsedBody - Parsed Twilio webhook form parameters.
 * @returns Provider-neutral inbound SMS message.
 */
function normalizeInboundSms(parsedBody: URLSearchParams): InboundSmsMessage {
  const fromE164 = requireFormValue(parsedBody, "From");

  if (!isLikelyE164(fromE164)) {
    throw new Error("Twilio From value must be E.164");
  }

  return {
    providerMessageSid: parsedBody.get("MessageSid"),
    fromE164,
    to: parsedBody.get("To"),
    body: parsedBody.get("Body") ?? "",
    rawPayload: formToPayload(parsedBody),
  };
}

/**
 * Converts form parameters into a JSON-safe payload.
 * @param parsedBody - Parsed provider form body.
 * @returns Plain object preserving duplicate keys as arrays.
 */
function formToPayload(parsedBody: URLSearchParams): Record<string, string | string[]> {
  const payload: Record<string, string | string[]> = {};

  for (const [key, value] of parsedBody.entries()) {
    const existing = payload[key];

    if (Array.isArray(existing)) {
      existing.push(value);
    } else if (existing !== undefined) {
      payload[key] = [existing, value];
    } else {
      payload[key] = value;
    }
  }

  return payload;
}

/**
 * Requires a provider form field.
 * @param parsedBody - Parsed provider form body.
 * @param key - Field name documented by Twilio.
 * @returns Non-empty form value.
 */
function requireFormValue(parsedBody: URLSearchParams, key: string): string {
  const value = parsedBody.get(key)?.trim();

  if (!value) {
    throw new Error(`Missing Twilio ${key} field`);
  }

  return value;
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
 * @param phoneE164 - Sender phone number after Twilio normalization.
 * @returns Access decision for job creation.
 * @remarks Non-production deployments keep an unset allowlist permissive so
 * local webhook tests do not require pilot configuration; production denies
 * execution unless the sender is explicitly listed.
 */
function checkSmsAllowlist(env: Env, phoneE164: string): SmsAccessDecision {
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

  if (allowedPhones.has(phoneE164)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "not_allowlisted",
    message: "This phone number is not enabled for the SMS pilot.",
  };
}

/**
 * Creates a TwiML response with the expected content type.
 * @param message - Optional immediate SMS reply.
 * @param status - HTTP status returned to Twilio.
 * @returns Response containing valid TwiML XML.
 */
function twimlResponse(message?: string, status = 200): Response {
  return new Response(createTwiMlResponse(message), {
    status,
    headers: { "content-type": "text/xml; charset=utf-8" },
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
 * Selects the per-language execution timeout for SMS jobs.
 * @param env - Worker bindings that may override the default execution budget.
 * @param language - Runtime selected by parser or user session state.
 * @returns Timeout in milliseconds captured on the execution job.
 * @remarks Java gets a slightly longer MVP default for compile startup while
 * explicit environment configuration still wins for all runtimes.
 */
function getExecutionTimeoutMs(env: Env, language: ReplLanguage): number {
  return parsePositiveInteger(
    env.EXECUTION_TIMEOUT_MS,
    language === "java" ? DEFAULT_JAVA_EXECUTION_TIMEOUT_MS : DEFAULT_EXECUTION_TIMEOUT_MS,
  );
}

/**
 * Builds the public status callback URL when the app origin is configured.
 * @param env - Worker bindings containing the public app base URL.
 * @returns Absolute status callback URL or undefined.
 */
function getStatusCallbackUrl(env: Env): string | undefined {
  const baseUrl = env.APP_BASE_URL?.trim();
  return baseUrl ? new URL("/api/twilio/status", baseUrl).toString() : undefined;
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
 * Logs a rejected Twilio webhook without persisting provider body content.
 * @param request - Request that failed signature validation.
 * @param parsedBody - Parsed form used only for low-cardinality metadata.
 * @remarks Forged webhooks are expected during probing, so the log keeps enough
 * context for triage without storing SMS text or raw payloads.
 */
function logTwilioSignatureFailure(request: Request, parsedBody: URLSearchParams): void {
  log("warn", "Rejected Twilio webhook signature", {
    path: new URL(request.url).pathname,
    hasSignature: request.headers.has("x-twilio-signature"),
    providerMessageSidHash: hashLogValue(parsedBody.get("MessageSid")),
    fromHash: hashLogValue(parsedBody.get("From")),
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
