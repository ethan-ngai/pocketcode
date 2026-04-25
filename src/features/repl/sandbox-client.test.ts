/**
 * @file sandbox-client.test.ts
 * @description Unit coverage for sandbox request validation.
 * @module repl
 */
import { describe, expect, it, vi } from "vitest";

import type { Env } from "../../shared/env";
import { executeInSandbox } from "./sandbox-client";
import type { ExecutionRequest } from "./repl.types";

vi.mock("@cloudflare/sandbox", () => ({
  getSandbox: () => {
    throw new Error("validation tests should not allocate a sandbox");
  },
}));

const env: Env = {
  DATABASE_URL: "postgres://example",
  BETTER_AUTH_SECRET: "auth-secret",
  BETTER_AUTH_URL: "http://localhost",
  SMS8_API_KEY: "sms8-key",
  SMS8_DEVICES: '["182|0"]',
  APP_BASE_URL: "http://localhost",
};

describe("executeInSandbox validation", () => {
  it("rejects common Python network attempts before sandbox allocation", async () => {
    await expect(
      executeInSandbox(
        {
          ...baseRequest("python"),
          code: 'import urllib.request\nprint(urllib.request.urlopen("https://example.com").read())',
        },
        env,
      ),
    ).resolves.toMatchObject({
      status: "rejected",
      errorCode: "EXECUTION_REJECTED",
      stderr: "Code rejected by safety policy.",
    });
  });

  it("rejects Java requests while the runtime is disabled", async () => {
    await expect(
      executeInSandbox(
        {
          ...baseRequest("java"),
          code: "public class Main { public static void main(String[] args) {} }",
        },
        env,
      ),
    ).resolves.toMatchObject({
      status: "rejected",
      errorCode: "EXECUTION_REJECTED",
      stderr: "Java execution is temporarily disabled. Use Python for now.",
    });
  });
});

/**
 * Builds the minimal execution request needed for validation tests.
 * @param language - Runtime selected for the submitted source.
 * @returns Execution request with conservative test policy values.
 */
function baseRequest(language: ExecutionRequest["language"]): ExecutionRequest {
  return {
    id: "job_test",
    userId: null,
    phoneE164: "+15555550123",
    language,
    code: "",
    timeoutMs: 5_000,
    maxOutputChars: 4_000,
  };
}
