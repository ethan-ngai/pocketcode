/**
 * @file signatures.ts
 * @description SMS8 signature validation boundary.
 * @module sms
 */
import type { Env } from "../../shared/env";

/**
 * Validates SMS8's HMAC-SHA256 request signature.
 * @param request - Original webhook request carrying SMS8's signature header.
 * @param env - Worker bindings containing the SMS8 API key and validation toggle.
 * @param messagesJson - Raw `messages` form value that SMS8 signed.
 * @returns True when the signature is valid or webhook auth is explicitly disabled.
 * @remarks SMS8 treats webhook API-key signing as optional, so production
 * deployments can opt out with `SMS8_WEBHOOK_AUTH_ENABLED=false` while keeping
 * signature checks enabled by default.
 */
export async function validateSms8Request(
  request: Request,
  env: Env,
  messagesJson: string | readonly string[],
): Promise<boolean> {
  if (isWebhookAuthBypassed(env)) {
    return true;
  }

  const signature =
    request.headers.get("x-sg-signature") ?? request.headers.get("http_x_sg_signature");

  if (!signature || !env.SMS8_API_KEY?.trim()) {
    return false;
  }

  const candidates = Array.isArray(messagesJson) ? messagesJson : [messagesJson];

  for (const candidate of candidates) {
    const expected = await computeSms8Signature(candidate, env.SMS8_API_KEY);

    if (timingSafeEqual(signature, expected)) {
      return true;
    }
  }

  return false;
}

/**
 * Computes the expected SMS8 request signature.
 * @param messagesJson - Raw JSON text from the signed `messages` form field.
 * @param apiKey - SMS8 API key shared with the webhook sender.
 * @returns Base64-encoded HMAC digest expected in `HTTP_X_SG_SIGNATURE`.
 * @remarks SMS8 signs only the raw `messages` payload, so form reserialization
 * must not occur before validation.
 */
async function computeSms8Signature(messagesJson: string, apiKey: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(messagesJson));

  return bytesToBase64(new Uint8Array(digest));
}

/**
 * Checks whether signature validation may be skipped.
 * @param env - Worker bindings containing the explicit auth toggle.
 * @returns True only when webhook authentication is explicitly disabled.
 * @remarks SMS8 can omit webhook API-key signing entirely, but the app keeps
 * authentication on unless operators intentionally set the toggle to false.
 */
function isWebhookAuthBypassed(env: Env): boolean {
  return env.SMS8_WEBHOOK_AUTH_ENABLED?.trim().toLowerCase() === "false";
}

/**
 * Compares signatures without early length or byte mismatch exits.
 * @param left - Signature supplied by SMS8.
 * @param right - Locally computed expected signature.
 * @returns True when both signatures are equal.
 * @remarks Web Crypto does not provide a timing-safe compare helper in Workers,
 * so this avoids the most obvious early-return side channel.
 */
function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

/**
 * Encodes binary data for SMS8 HMAC values.
 * @param bytes - Raw bytes produced by Web Crypto.
 * @returns Base64 text compatible with SMS8 headers.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
