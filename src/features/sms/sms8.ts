/**
 * @file sms8.ts
 * @description SMS8 REST client boundary for outbound SMS.
 * @module sms
 */
import type { Env } from "../../shared/env";

const SMS8_SEND_URL = "https://app.sms8.io/services/send.php";

/**
 * Input required for sending an outbound SMS through SMS8.
 * @remarks Execution code passes provider-neutral message details while this
 * boundary owns API keys, device routing, and SMS8 response parsing.
 */
export interface SendSmsInput {
  /** Destination phone number in the provider-accepted format. */
  to: string;
  /** User-visible message body after chunking policy has been applied. */
  body: string;
  /** Worker bindings containing SMS8 credentials and device configuration. */
  env: Env;
}

/**
 * Sends one SMS through SMS8's Android gateway API.
 * @param input - Delivery details plus runtime SMS8 configuration.
 * @returns Provider message id used to correlate local outbound rows.
 * @remarks SMS8 exposes sending as a GET endpoint, so query construction stays
 * centralized here to avoid leaking secrets or device route details elsewhere.
 */
export async function sendSms(input: SendSmsInput): Promise<{ providerMessageSid: string }> {
  const apiKey = requireSms8Value(input.env.SMS8_API_KEY, "SMS8_API_KEY");
  const devices = parseSms8Devices(input.env.SMS8_DEVICES);
  const url = new URL(SMS8_SEND_URL);

  url.searchParams.set("key", apiKey);
  url.searchParams.set("number", input.to);
  url.searchParams.set("message", input.body);
  url.searchParams.set("devices", JSON.stringify(devices));
  url.searchParams.set("type", "sms");
  url.searchParams.set("prioritize", parseSms8Prioritize(input.env.SMS8_PRIORITIZE));

  const response = await fetch(url);
  const responseBody = await parseSms8Response(response);

  if (!response.ok || responseBody.success !== true) {
    throw new Error(extractSms8ErrorMessage(responseBody));
  }

  const message = responseBody.data?.messages?.[0];
  const providerMessageSid = message?.ID ?? message?.groupID;

  if (providerMessageSid === undefined || providerMessageSid === null || providerMessageSid === "") {
    throw new Error("SMS8 response did not include a message ID");
  }

  return { providerMessageSid: String(providerMessageSid) };
}

/**
 * Parses SMS8's JSON error or success body.
 * @param response - Fetch response returned by the SMS8 REST endpoint.
 * @returns Object body when JSON parsing succeeds, otherwise an empty object.
 */
async function parseSms8Response(response: Response): Promise<Sms8SendResponse> {
  try {
    return (await response.json()) as Sms8SendResponse;
  } catch {
    return {};
  }
}

/**
 * Reads a useful SMS8 error message without exposing secrets.
 * @param responseBody - Parsed SMS8 response body.
 * @returns Provider message or a generic send failure.
 */
function extractSms8ErrorMessage(responseBody: Sms8SendResponse): string {
  return typeof responseBody.error?.message === "string"
    ? responseBody.error.message
    : "SMS8 send failed.";
}

/**
 * Requires a non-empty SMS8 binding.
 * @param value - Raw Worker binding value.
 * @param name - Binding name for setup diagnostics.
 * @returns Trimmed credential or configuration value.
 */
function requireSms8Value(value: string | undefined, name: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}

/**
 * Parses SMS8 device routing configuration.
 * @param value - JSON-encoded device route list from Worker bindings.
 * @returns Non-empty device route strings accepted by SMS8.
 */
function parseSms8Devices(value: string | undefined): readonly string[] {
  const raw = requireSms8Value(value, "SMS8_DEVICES");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("SMS8_DEVICES must be a JSON array of device routes");
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    parsed.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw new Error("SMS8_DEVICES must be a non-empty JSON array of device routes");
  }

  return parsed.map((entry) => entry.trim());
}

/**
 * Converts SMS8 prioritize configuration into its wire format.
 * @param value - Optional boolean-like Worker binding.
 * @returns `"1"` when prioritization is enabled, otherwise `"0"`.
 */
function parseSms8Prioritize(value: string | undefined): "0" | "1" {
  return value?.trim().toLowerCase() === "1" || value?.trim().toLowerCase() === "true" ? "1" : "0";
}

/**
 * Minimal SMS8 send response shape used by the provider boundary.
 * @remarks SMS8 returns many additional fields; only ids and errors are needed
 * by Pocketcode while the full provider payload remains outside app contracts.
 */
interface Sms8SendResponse {
  /** Whether SMS8 accepted the request. */
  success?: boolean;
  /** Send result payload when the request succeeded. */
  data?: {
    /** Per-message records created by SMS8. */
    messages?: Array<{
      /** SMS8 message identifier. */
      ID?: number | string;
      /** SMS8 group identifier when several device sends are created together. */
      groupID?: string | null;
    }>;
  } | null;
  /** Provider error payload when the request failed. */
  error?: {
    /** Provider error code. */
    code?: number | string;
    /** Human-readable provider error. */
    message?: string;
  } | null;
}
