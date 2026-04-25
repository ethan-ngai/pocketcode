/**
 * @file responder.test.ts
 * @description Unit coverage for SMS response formatting.
 * @module sms
 */
import { describe, expect, it } from "vitest";

import { createTwiMlResponse, formatExecutionSmsMessages, formatSmsOutput } from "./responder";
import { SMS_OUTPUT_CHUNK_CHARS } from "./sms.types";

describe("formatSmsOutput", () => {
  it("chunks long output and appends a truncation notice", () => {
    const chunks = formatSmsOutput("x".repeat(SMS_OUTPUT_CHUNK_CHARS * 3), "Output:\n");

    expect(chunks).toHaveLength(2);
    expect(chunks[0].startsWith("Output:\n")).toBe(true);
    expect(chunks[1].endsWith("\n...[truncated]")).toBe(true);
    expect(chunks.every((chunk) => chunk.length <= SMS_OUTPUT_CHUNK_CHARS)).toBe(true);
  });

  it("removes terminal escapes and normalizes empty output", () => {
    expect(formatSmsOutput("\u001B[31mhello\u001B[0m\r\n", "Output:\n")).toEqual([
      "Output:\nhello",
    ]);
    expect(formatSmsOutput("", "Output:\n")).toEqual(["Output:\n(no output)"]);
  });
});

describe("formatExecutionSmsMessages", () => {
  it("prioritizes timeout copy over streams", () => {
    expect(
      formatExecutionSmsMessages({
        status: "timed_out",
        stdout: "partial",
        stderr: "timeout",
        exitCode: null,
        durationMs: 5_000,
        timeoutMs: 8_000,
      }),
    ).toEqual(["Timed out after 8s."]);
  });

  it("formats stderr-only failures as errors", () => {
    expect(
      formatExecutionSmsMessages({
        status: "failed",
        stdout: "",
        stderr: "NameError",
        exitCode: 1,
        durationMs: 12,
      }),
    ).toEqual(["Error:\nNameError"]);
  });
});

describe("createTwiMlResponse", () => {
  it("escapes XML-sensitive result text", () => {
    expect(createTwiMlResponse("<ok>&\"'")).toContain(
      "&lt;ok&gt;&amp;&quot;&apos;",
    );
  });
});
