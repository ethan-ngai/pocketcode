/**
 * @file signatures.ts
 * @description Twilio signature validation boundary.
 * @module sms
 */
import type { Env } from "../../shared/env";

/**
 * Validates Twilio's HMAC-SHA1 request signature.
 * @param request - Original webhook request so URL and signature header match Twilio's base string.
 * @param env - Worker bindings containing the Twilio auth token and validation toggle.
 * @param parsedBody - Form body parsed before business logic trusts provider fields.
 * @returns True when the signature is valid or a local development bypass is explicitly enabled.
 * @remarks The bypass is intentionally constrained to local/dev contexts because
 * webhook handlers must fail closed once exposed to the public internet.
 */
export async function validateTwilioRequest(
  request: Request,
  env: Env,
  parsedBody: URLSearchParams,
): Promise<boolean> {
  if (isWebhookAuthBypassed(request, env)) {
    return true;
  }

  const signature = request.headers.get("x-twilio-signature");

  if (!signature || !env.TWILIO_AUTH_TOKEN?.trim()) {
    return false;
  }

  const expected = await computeTwilioSignature(request.url, parsedBody, env.TWILIO_AUTH_TOKEN);
  return timingSafeEqual(signature, expected);
}

/**
 * Computes the expected Twilio request signature.
 * @param url - Absolute URL Twilio requested, including query string.
 * @param parsedBody - Form parameters included in the webhook POST.
 * @param authToken - Account auth token shared with Twilio.
 * @returns Base64-encoded HMAC digest expected in `X-Twilio-Signature`.
 * @remarks Twilio's legacy webhook signature format sorts all POST parameter
 * names lexicographically and appends each name/value pair to the URL before HMAC.
 */
async function computeTwilioSignature(
  url: string,
  parsedBody: URLSearchParams,
  authToken: string,
): Promise<string> {
  const baseString = [...parsedBody.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce((accumulator, [key, value]) => `${accumulator}${key}${value}`, url);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(baseString));

  return bytesToBase64(new Uint8Array(digest));
}

/**
 * Checks whether signature validation may be skipped.
 * @param request - Request used to infer localhost development contexts.
 * @param env - Worker bindings containing the explicit auth toggle.
 * @returns True only for explicit false toggles in local or development environments.
 * @remarks This keeps local webhook tooling convenient without creating an
 * accidental production escape hatch through configuration alone.
 */
function isWebhookAuthBypassed(request: Request, env: Env): boolean {
  if (env.TWILIO_WEBHOOK_AUTH_ENABLED?.trim().toLowerCase() !== "false") {
    return false;
  }

  const hostname = new URL(request.url).hostname.toLowerCase();
  const environment = env.ENVIRONMENT?.trim().toLowerCase();

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    environment === "local" ||
    environment === "development" ||
    environment === "dev"
  );
}

/**
 * Compares signatures without early length or byte mismatch exits.
 * @param left - Signature supplied by Twilio.
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
 * Encodes binary data for HTTP Basic and Twilio HMAC values.
 * @param bytes - Raw bytes produced by Web Crypto.
 * @returns Base64 text compatible with Twilio headers.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
