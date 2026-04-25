/**
 * @file responder.ts
 * @description SMS response formatting helpers shared by Twilio and execution flows.
 * @module sms
 */
import { SMS_OUTPUT_CHUNK_CHARS } from "./sms.types";

/**
 * Splits output into SMS-safe chunks with a truncation notice.
 * @param output - Full combined output intended for a user.
 * @returns One or more chunks under the configured SMS size budget.
 * @remarks MVP output sends only the first payload-sized chunk, but returning an
 * array preserves room for later multi-message delivery without changing callers.
 */
export function formatSmsOutput(output: string): string[] {
  if (output.length <= SMS_OUTPUT_CHUNK_CHARS) {
    return [output || "(no output)"];
  }

  const notice = "\n...[truncated]";
  return [`${output.slice(0, SMS_OUTPUT_CHUNK_CHARS - notice.length)}${notice}`];
}

/**
 * Builds a minimal TwiML response body.
 * @param message - Optional message to include in the immediate webhook reply.
 * @returns XML TwiML response accepted by Twilio.
 * @remarks Twilio requires a fast webhook response, so long-running execution
 * results should be sent later through the REST API rather than blocking here.
 */
export function createTwiMlResponse(message?: string): string {
  if (!message) {
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
    message,
  )}</Message></Response>`;
}

/**
 * Escapes XML entities in user-visible SMS text.
 * @param value - Text that will be embedded in a TwiML XML document.
 * @returns XML-safe text.
 * @remarks Twilio webhook responses are XML, so output must not let code results
 * accidentally break the response document.
 */
function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
