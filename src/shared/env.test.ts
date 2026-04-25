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
  SMS8_API_KEY: "sms8-key",
  SMS8_DEVICES: '["182|0"]',
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
      SMS8_WEBHOOK_AUTH_ENABLED: "false",
      SMS8_PRIORITIZE: "true",
    });

    expect(config.adminEmails.has("admin@example.test")).toBe(true);
    expect(config.executionTimeoutMs).toBe(9_000);
    expect(config.executionMaxOutputChars).toBe(1_234);
    expect(config.smsAllowlist.has("+15555550124")).toBe(true);
    expect(config.sms8WebhookAuthEnabled).toBe(false);
    expect(config.sms8Devices).toEqual(["182|0"]);
    expect(config.sms8Prioritize).toBe(true);
  });

  it("requires SMS8 device routing", () => {
    expect(() =>
      getAppConfig({
        ...baseEnv,
        SMS8_DEVICES: "",
      }),
    ).toThrow("SMS8_DEVICES is required");
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

  it("does not require SMS provider secrets for auth-only routes", () => {
    expect(
      getAuthConfig({
        ...baseEnv,
        SMS8_API_KEY: "",
        SMS8_DEVICES: "",
      }).betterAuthUrl,
    ).toBe("https://auth.example.test");
  });
});
