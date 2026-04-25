/**
 * @file responder.ts
 * @description SMS response formatting helpers shared by Twilio and execution flows.
 * @module sms
 */
import { SMS_OUTPUT_CHUNK_CHARS } from "./sms.types";
import type { ExecutionResult } from "../repl/repl.types";

/** Maximum result messages sent for one execution in the MVP. */
const SMS_OUTPUT_MAX_CHUNKS = 2;

/** Help text intentionally stays terse for low-bandwidth SMS users. */
export const SMS_HELP_TEXT = "Commands:\npy <code>\njava <code>\nlang py\nlang java\nreset";

const ANSI_ESCAPE_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

/**
 * Splits output into SMS-safe chunks with a truncation notice.
 * @param output - Full combined output intended for a user.
 * @param prefix - User-visible prefix that should appear only on the first chunk.
 * @returns One or two chunks under the configured SMS size budget.
 * @remarks The full execution output is stored before formatting; this helper
 * only enforces the limited SMS preview policy from the Twilio MVP.
 */
export function formatSmsOutput(output: string, prefix = ""): string[] {
  const source = sanitizeSmsText(output) || "(no output)";
  const chunks: string[] = [];
  let remaining = source;

  while (remaining && chunks.length < SMS_OUTPUT_MAX_CHUNKS) {
    const currentPrefix = chunks.length === 0 ? prefix : "";
    const availableChars = SMS_OUTPUT_CHUNK_CHARS - currentPrefix.length;
    const slice = remaining.slice(0, availableChars);

    chunks.push(`${currentPrefix}${slice}`);
    remaining = remaining.slice(slice.length);
  }

  if (remaining && chunks.length > 0) {
    const notice = "\n...[truncated]";
    const lastIndex = chunks.length - 1;
    chunks[lastIndex] = `${chunks[lastIndex].slice(0, SMS_OUTPUT_CHUNK_CHARS - notice.length)}${notice}`;
  }

  return chunks.length > 0 ? chunks : [`${prefix}(no output)`];
}

/**
 * Formats a sandbox result for outbound SMS delivery.
 * @param result - Terminal execution result already persisted by the job layer.
 * @returns SMS chunks ready to send through Twilio.
 * @remarks The prefix rules intentionally trade detail for quick comprehension
 * on small phone screens while admin views retain the full stdout/stderr split.
 */
export function formatExecutionSmsMessages(result: ExecutionResult): string[] {
  if (result.status === "timed_out") {
    return ["Timed out after 5s."];
  }

  if (result.stderr && !result.stdout) {
    return formatSmsOutput(result.stderr, "Error:\n");
  }

  const output =
    result.stderr && result.stdout ? `${result.stdout.trimEnd()}\n${result.stderr}` : result.stdout;

  return formatSmsOutput(output, "Output:\n");
}

/**
 * Normalizes execution text for unpredictable SMS clients.
 * @param value - Raw stdout, stderr, or combined output from the sandbox.
 * @returns Text with ANSI escapes removed, newlines normalized, and trailing whitespace trimmed.
 * @remarks The database keeps raw streams; SMS delivery gets conservative text
 * so phones do not render escape codes, Markdown, or ragged trailing spaces.
 */
export function sanitizeSmsText(value: string): string {
  return value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
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
