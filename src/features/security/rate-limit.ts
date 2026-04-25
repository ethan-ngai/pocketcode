/**
 * @file rate-limit.ts
 * @description Persistent rate-limit boundary for SMS execution abuse controls.
 * @module security
 */
import type { Db } from "../db/client";
import { DEFAULT_SMS_EXECUTIONS_PER_DAY, DEFAULT_SMS_EXECUTIONS_PER_HOUR } from "./quotas";
import type { RateLimitDecision } from "./security.types";

/**
 * Checks whether a phone number may create another execution job.
 * @param db - Database boundary that owns quota overrides and execution counts.
 * @param phoneE164 - Sender phone number already normalized to E.164.
 * @param now - Clock value supplied by tests or the current Worker request.
 * @returns Allow or deny decision with SMS-safe copy.
 * @remarks Counting persisted jobs makes Twilio retries and future admin tools
 * share the same source of truth before any hot-path KV optimization exists.
 */
export async function checkSmsExecutionRateLimit(
  db: Db,
  phoneE164: string,
  now: Date = new Date(),
): Promise<RateLimitDecision> {
  const quota = await db.getSmsQuota(phoneE164);
  const hourlyLimit = quota?.hourlyLimit ?? DEFAULT_SMS_EXECUTIONS_PER_HOUR;
  const dailyLimit = quota?.dailyLimit ?? DEFAULT_SMS_EXECUTIONS_PER_DAY;

  if (quota?.disabled) {
    const suffix = quota.reason ? ` Reason: ${quota.reason}` : "";
    return deny("disabled", null, `This phone number is disabled.${suffix}`);
  }

  const hourlyCount = await db.countExecutionsForPhone(
    phoneE164,
    new Date(now.getTime() - 60 * 60 * 1_000),
  );

  if (hourlyCount >= hourlyLimit) {
    return deny("hourly_limit", 60 * 60, "Hourly limit reached. Try again later.");
  }

  const dailyCount = await db.countExecutionsForPhone(
    phoneE164,
    new Date(now.getTime() - 24 * 60 * 60 * 1_000),
  );

  if (dailyCount >= dailyLimit) {
    return deny("daily_limit", 24 * 60 * 60, "Daily limit reached. Try again tomorrow.");
  }

  return { allowed: true, retryAfterSeconds: null, reason: "allowed", message: null };
}

/**
 * Builds a denied decision with one stable shape.
 * @param reason - Machine-readable denial reason for logs and tests.
 * @param retryAfterSeconds - Retry delay when the denial is time-window based.
 * @param message - SMS-safe refusal message.
 * @returns Rate-limit denial decision.
 */
function deny(
  reason: RateLimitDecision["reason"],
  retryAfterSeconds: number | null,
  message: string,
): RateLimitDecision {
  return { allowed: false, retryAfterSeconds, reason, message };
}
