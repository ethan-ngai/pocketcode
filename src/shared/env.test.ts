/**
 * @file env.test.ts
 * @description Unit coverage for Worker binding configuration parsing.
 * @module shared
 */
import { describe, expect, it } from "vitest";

import type { Env } from "./env";
import { getAppConfig, getAuthConfig } from "./env";

const baseEnv: Env = {
  DATABASE_URL: "postgres://example",
  BETTER_AUTH_SECRET: "auth-secret",
  BETTER_AUTH_URL: "https://auth.example.test",
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: "twilio-token",
  TWILIO_FROM_NUMBER: "+15555550999",
  APP_BASE_URL: "https://app.example.test",
};

describe("getAppConfig", () => {
  it("normalizes optional values and execution policy", () => {
    const config = getAppConfig({
      ...baseEnv,
      ADMIN_EMAILS: "Admin@Example.test, ops@example.test",
      SMS_ALLOWLIST: "+15555550123, +15555550124",
      EXECUTION_TIMEOUT_MS: "9000",
      EXECUTION_MAX_OUTPUT_CHARS: "1234",
      TWILIO_WEBHOOK_AUTH_ENABLED: "false",
    });

    expect(config.adminEmails.has("admin@example.test")).toBe(true);
    expect(config.executionTimeoutMs).toBe(9_000);
    expect(config.executionMaxOutputChars).toBe(1_234);
    expect(config.smsAllowlist.has("+15555550124")).toBe(true);
    expect(config.twilioWebhookAuthEnabled).toBe(false);
  });

  it("requires a Twilio sender", () => {
    expect(() =>
      getAppConfig({
        ...baseEnv,
        TWILIO_FROM_NUMBER: undefined,
        TWILIO_MESSAGING_SERVICE_SID: undefined,
      }),
    ).toThrow("TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER is required");
  });

  it("rejects invalid numeric execution policy", () => {
    expect(() => getAppConfig({ ...baseEnv, EXECUTION_TIMEOUT_MS: "0" })).toThrow(
      "EXECUTION_TIMEOUT_MS must be a positive integer",
    );
  });
});

describe("getAuthConfig", () => {
  it("accepts Hyperdrive as the preferred database source", () => {
    const config = getAuthConfig({
      ...baseEnv,
      DATABASE_URL: undefined,
      HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
    });

    expect(config.databaseUrl).toBe("postgres://hyperdrive");
    expect(config.usesHyperdrive).toBe(true);
  });

  it("does not require Twilio secrets for auth-only routes", () => {
    expect(
      getAuthConfig({
        ...baseEnv,
        TWILIO_ACCOUNT_SID: "",
        TWILIO_AUTH_TOKEN: "",
        TWILIO_FROM_NUMBER: undefined,
      }).betterAuthUrl,
    ).toBe("https://auth.example.test");
  });
});
