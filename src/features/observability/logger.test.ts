/**
 * @file logger.test.ts
 * @description Unit coverage for structured log redaction.
 * @module observability
 */
import { describe, expect, it } from "vitest";

import { createLogger, hashLogValue } from "./logger";

describe("createLogger", () => {
  it("redacts secrets, URLs, and source bodies by default", () => {
    const entries: string[] = [];
    const sink = {
      debug: (entry: string) => entries.push(entry),
      info: (entry: string) => entries.push(entry),
      warn: (entry: string) => entries.push(entry),
      error: (entry: string) => entries.push(entry),
    };

    createLogger({ sink }).info("execution.finished", {
      jobId: "job_1",
      SMS8_API_KEY: "secret",
      DATABASE_URL: "postgres://secret",
      code: "print(secret)",
      nested: { body: "sms body" },
    });

    const emitted = JSON.parse(entries[0] ?? "{}") as {
      event: string;
      metadata: Record<string, unknown>;
    };

    expect(emitted.event).toBe("execution.finished");
    expect(emitted.metadata).toMatchObject({
      jobId: "job_1",
      SMS8_API_KEY: "[redacted]",
      DATABASE_URL: "[redacted]",
      code: "[redacted]",
      nested: { body: "[redacted]" },
    });
  });
});

describe("hashLogValue", () => {
  it("returns stable fingerprints without exposing the original value", () => {
    expect(hashLogValue("+15555550123")).toBe(hashLogValue("+15555550123"));
    expect(hashLogValue("+15555550123")).not.toContain("+15555550123");
  });
});
