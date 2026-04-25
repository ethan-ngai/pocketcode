/**
 * @file twilio.ts
 * @description Twilio REST client boundary for outbound SMS.
 * @module sms
 */
import type { Env } from "../../shared/env";

/**
 * Input required for sending an outbound SMS through Twilio.
 * @remarks The provider client chooses MessagingServiceSid over From when both
 * are configured so production can rotate sender numbers without code changes.
 */
export interface SendSmsInput {
  /** E.164 destination phone number. */
  to: string;
  /** User-visible message body after SMS chunking policy has been applied. */
  body: string;
  /** Worker bindings containing Twilio credentials and sender configuration. */
  env: Env;
  /** Public callback URL for provider delivery status events. */
  statusCallbackUrl?: string;
}

/**
 * Sends one SMS through Twilio's REST API.
 * @param input - Delivery details plus runtime Twilio configuration.
 * @returns Provider SID used to correlate later status callbacks.
 * @remarks This boundary is intentionally fetch-only so execution and parser code
 * never import Twilio SDKs or access account credentials directly.
 */
export async function sendSms(input: SendSmsInput): Promise<{ providerMessageSid: string }> {
  const accountSid = requireTwilioValue(input.env.TWILIO_ACCOUNT_SID, "TWILIO_ACCOUNT_SID");
  const authToken = requireTwilioValue(input.env.TWILIO_AUTH_TOKEN, "TWILIO_AUTH_TOKEN");
  const messagingServiceSid = emptyToNull(input.env.TWILIO_MESSAGING_SERVICE_SID);
  const from = emptyToNull(input.env.TWILIO_FROM_NUMBER);

  if (!messagingServiceSid && !from) {
    throw new Error("TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER is required");
  }

  const body = new URLSearchParams({
    To: input.to,
    Body: input.body,
  });

  if (messagingServiceSid) {
    body.set("MessagingServiceSid", messagingServiceSid);
  } else if (from) {
    body.set("From", from);
  }

  if (input.statusCallbackUrl) {
    body.set("StatusCallback", input.statusCallbackUrl);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  const responseBody = await parseTwilioResponse(response);

  if (!response.ok) {
    const message =
      typeof responseBody.message === "string" ? responseBody.message : "Twilio send failed.";
    throw new Error(message);
  }

  if (typeof responseBody.sid !== "string" || !responseBody.sid) {
    throw new Error("Twilio response did not include a message SID");
  }

  return { providerMessageSid: responseBody.sid };
}

/**
 * Parses Twilio's JSON error or success body.
 * @param response - Fetch response returned by the Twilio REST endpoint.
 * @returns Object body when JSON parsing succeeds, otherwise an empty object.
 */
async function parseTwilioResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Requires a non-empty Twilio binding.
 * @param value - Raw Worker binding value.
 * @param name - Binding name for setup diagnostics.
 * @returns Trimmed credential or identifier.
 */
function requireTwilioValue(value: string | undefined, name: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}

/**
 * Normalizes optional Twilio sender bindings.
 * @param value - Optional Worker binding value.
 * @returns Trimmed binding or null when blank.
 */
function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
