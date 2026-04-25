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
  java: "java",
};

/**
 * Parses an SMS body into a command understood by the execution workflow.
 * @param body - Raw SMS body provided by Twilio.
 * @param defaultLanguage - Sender language preference used for bare code, defaulting to Python when unset.
 * @returns Parsed command or an unknown reason safe for SMS responses.
 * @remarks The MVP is single-shot execution, so bare messages execute in the
 * sender's default language while explicit prefixes override that preference.
 */
export function parseSmsCommand(body: string, defaultLanguage: ReplLanguage | null = "python"): SmsCommand {
  const trimmed = body.trim();

  if (!trimmed) {
    return { kind: "unknown", reason: "Message body is empty." };
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
    const language = LANGUAGE_ALIASES[remainder.toLowerCase()];
    return language
      ? { kind: "set_language", language }
      : { kind: "unknown", reason: "Use lang py or lang java." };
  }

  const explicitLanguage = LANGUAGE_ALIASES[commandLower];
  const code = explicitLanguage ? remainder : trimmed;

  if (!code) {
    return { kind: "unknown", reason: "Send code after py or java." };
  }

  if (code.length > SMS_MAX_SOURCE_CHARS) {
    return { kind: "unknown", reason: `Code is limited to ${SMS_MAX_SOURCE_CHARS} characters.` };
  }

  return {
    kind: "execute",
    language: explicitLanguage ?? defaultLanguage ?? "python",
    code,
  };
}
