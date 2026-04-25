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
    ["lang java", { kind: "set_language", language: "java" }],
    ['py print("hi")', { kind: "execute", language: "python", code: 'print("hi")' }],
    ['python print("hi")', { kind: "execute", language: "python", code: 'print("hi")' }],
    [
      'java System.out.println("hi");',
      { kind: "execute", language: "java", code: 'System.out.println("hi");' },
    ],
    [
      'print("default language")',
      { kind: "execute", language: "python", code: 'print("default language")' },
    ],
  ])("parses %s", (body, expected) => {
    expect(parseSmsCommand(body)).toEqual(expected);
  });

  it("uses the persisted default language for bare source", () => {
    expect(parseSmsCommand('System.out.println("default");', "java")).toEqual({
      kind: "execute",
      language: "java",
      code: 'System.out.println("default");',
    });
  });

  it("returns SMS-safe copy for unsupported commands", () => {
    expect(parseSmsCommand("lang ruby")).toEqual({
      kind: "unknown",
      reason: "Unknown command. Text HELP for examples.",
    });
  });
});
