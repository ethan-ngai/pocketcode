/**
 * @file sms8.test.ts
 * @description Unit coverage for the SMS8 outbound client boundary.
 * @module sms
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Env } from "../../shared/env";
import { sendSms } from "./sms8";

const env: Env = {
  DATABASE_URL: "postgres://example",
  BETTER_AUTH_SECRET: "auth-secret",
  BETTER_AUTH_URL: "http://localhost",
  SMS8_API_KEY: "sms8-key",
  SMS8_DEVICES: '["182|0"]',
  APP_BASE_URL: "http://localhost",
};

describe("sendSms", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends SMS8 requests with the configured device route", async () => {
    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return Response.json({
        success: true,
        data: { messages: [{ ID: 296180, groupID: null }] },
        error: null,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendSms({ to: "+15555550123", body: "hello", env });
    const requestedUrl = new URL(requestedUrls[0] ?? "");

    expect(result.providerMessageSid).toBe("296180");
    expect(requestedUrl.origin).toBe("https://app.sms8.io");
    expect(requestedUrl.pathname).toBe("/services/send.php");
    expect(requestedUrl.searchParams.get("key")).toBe("sms8-key");
    expect(requestedUrl.searchParams.get("number")).toBe("+15555550123");
    expect(requestedUrl.searchParams.get("message")).toBe("hello");
    expect(requestedUrl.searchParams.get("devices")).toBe('["182|0"]');
    expect(requestedUrl.searchParams.get("type")).toBe("sms");
    expect(requestedUrl.searchParams.get("prioritize")).toBe("0");
  });

  it("surfaces provider error messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { success: false, data: null, error: { code: 401, message: "This API key is invalid." } },
          { status: 401 },
        ),
      ),
    );

    await expect(sendSms({ to: "+15555550123", body: "hello", env })).rejects.toThrow(
      "This API key is invalid.",
    );
  });
});
