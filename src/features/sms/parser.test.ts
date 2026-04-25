/**
 * @file parser.test.ts
 * @description Unit coverage for SMS command parsing.
 * @module sms
 */
import { describe, expect, it } from "vitest";

import { parseSmsCommand } from "./parser";

describe("parseSmsCommand", () => {
  it.each([
    ["help", { kind: "help" }],
    ["reset", { kind: "reset" }],
    ["lang py", { kind: "set_language", language: "python" }],
    ["lang python", { kind: "set_language", language: "python" }],
    ['py print("hi")', { kind: "execute", language: "python", code: 'print("hi")' }],
    ['python print("hi")', { kind: "execute", language: "python", code: 'print("hi")' }],
    [
      'print("default language")',
      { kind: "execute", language: "python", code: 'print("default language")' },
    ],
  ])("parses %s", (body, expected) => {
    expect(parseSmsCommand(body)).toEqual(expected);
  });

  it("falls back to Python for bare source when persisted default Java is disabled", () => {
    expect(parseSmsCommand('System.out.println("default");', "java")).toEqual({
      kind: "execute",
      language: "python",
      code: 'System.out.println("default");',
    });
  });

  it.each(["lang java", 'java System.out.println("hi");'])(
    "returns SMS-safe copy while Java is disabled for %s",
    (body) => {
      expect(parseSmsCommand(body)).toEqual({
        kind: "unknown",
        reason: "Java is temporarily disabled. Use py <code> for now.",
      });
    },
  );

  it("returns SMS-safe copy for unsupported commands", () => {
    expect(parseSmsCommand("lang ruby")).toEqual({
      kind: "unknown",
      reason: "Unknown command. Text HELP for examples.",
    });
  });
});
