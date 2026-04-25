/**
 * @file parser.ts
 * @description SMS command parser for the shared Phase 0 contract.
 * @module sms
 */
import type { ReplLanguage, SmsCommand } from "../repl/repl.types";
import { SMS_MAX_SOURCE_CHARS } from "./sms.types";

const LANGUAGE_ALIASES: Record<string, ReplLanguage> = {
  py: "python",
  python: "python",
};

const JAVA_DISABLED_REASON = "Java is temporarily disabled. Use py <code> for now.";

/**
 * Parses an SMS body into a command understood by the execution workflow.
 * @param body - Raw SMS body provided by the SMS provider.
 * @param defaultLanguage - Sender language preference used for bare code, defaulting to Python when unset.
 * @returns Parsed command or an unknown reason safe for SMS responses.
 * @remarks The MVP is single-shot execution, so bare messages execute in the
 * sender's default language while explicit prefixes override that preference.
 */
export function parseSmsCommand(
  body: string,
  defaultLanguage: ReplLanguage | null = "python",
): SmsCommand {
  const trimmed = body.trim();

  if (!trimmed) {
    return { kind: "unknown", reason: "Unknown command. Text HELP for examples." };
  }

  const [command, ...rest] = trimmed.split(/\s+/);
  const commandLower = command.toLowerCase();
  const remainder = rest.join(" ").trim();

  if (commandLower === "help") {
    return { kind: "help" };
  }

  if (commandLower === "reset") {
    return { kind: "reset" };
  }

  if (commandLower === "lang") {
    if (remainder.toLowerCase() === "java") {
      return { kind: "unknown", reason: JAVA_DISABLED_REASON };
    }

    const language = LANGUAGE_ALIASES[remainder.toLowerCase()];
    return language
      ? { kind: "set_language", language }
      : { kind: "unknown", reason: "Unknown command. Text HELP for examples." };
  }

  if (commandLower === "java") {
    return { kind: "unknown", reason: JAVA_DISABLED_REASON };
  }

  const explicitLanguage = LANGUAGE_ALIASES[commandLower];
  const code = explicitLanguage ? remainder : trimmed;

  if (!code) {
    return { kind: "unknown", reason: "Unknown command. Text HELP for examples." };
  }

  if (code.length > SMS_MAX_SOURCE_CHARS) {
    return {
      kind: "unknown",
      reason: `Code is too long. Limit: ${SMS_MAX_SOURCE_CHARS} characters.`,
    };
  }

  return {
    kind: "execute",
    language: explicitLanguage ?? normalizeDefaultLanguage(defaultLanguage),
    code,
  };
}

/**
 * Coerces persisted sender defaults to currently enabled runtimes.
 * @param language - Saved sender preference that may predate temporary runtime changes.
 * @returns Python while Java support is disabled.
 * @remarks Keeping this in the parser avoids creating Java jobs from bare SMS
 * text for users who previously selected Java.
 */
function normalizeDefaultLanguage(language: ReplLanguage | null): ReplLanguage {
  return language === "python" ? language : "python";
}
