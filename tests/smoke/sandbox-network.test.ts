/**
 * @file sandbox-network.test.ts
 * @description Opt-in smoke coverage for deployed sandbox outbound-network policy.
 * @module tests
 */
import { describe, expect, it } from "vitest";

const smokeEnv =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const executeUrl = smokeEnv.POCKETCODE_SMOKE_REPL_EXECUTE_URL;
const adminCookie = smokeEnv.POCKETCODE_SMOKE_ADMIN_COOKIE;
const runSmoke = Boolean(executeUrl && adminCookie);

describe.skipIf(!runSmoke)("sandbox network smoke", () => {
  it("fails a Python network request through the deployed manual execution route", async () => {
    const response = await fetch(executeUrl as string, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: adminCookie as string,
      },
      body: JSON.stringify({
        language: "python",
        code: 'import urllib.request\nprint(urllib.request.urlopen("https://example.com", timeout=2).status)',
        timeoutMs: 5_000,
      }),
    });
    const result = (await response.json()) as { status?: string; errorCode?: string };

    expect(response.status).toBe(200);
    expect(result.status).not.toBe("succeeded");
    expect(["EXECUTION_REJECTED", "EXECUTION_TIMEOUT", "PROCESS_EXIT_NONZERO"]).toContain(
      result.errorCode,
    );
  });
});
