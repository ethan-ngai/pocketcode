/**
 * @file twilio-inbound.test.ts
 * @description Integration coverage for Twilio webhook handling without Twilio or sandbox execution.
 * @module tests
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/features/repl/sandbox-client", () => ({
  executeInSandbox: async () => ({
    status: "succeeded",
    stdout: "hi\n",
    stderr: "",
    exitCode: 0,
    durationMs: 7,
    sandboxId: "sandbox_test",
  }),
}));

const dbClientMock = vi.hoisted(() => ({
  productionDb: undefined as InMemoryDb | undefined,
  createPostgresDb: vi.fn(() => {
    if (!dbClientMock.productionDb) {
      throw new Error("production DB mock is not configured");
    }

    return dbClientMock.productionDb;
  }),
}));

vi.mock("../../src/features/db/client", () => ({
  createPostgresDb: dbClientMock.createPostgresDb,
}));

import type { Env } from "../../src/shared/env";
import { handleTwilioInbound, type WaitUntil } from "../../src/features/sms/sms.functions";
import type { SmsDependencies } from "../../src/features/sms/sms.functions";
import { runExecutionJob } from "../../src/features/repl/jobs";
import { createInMemoryDb, type InMemoryDb } from "../helpers/in-memory-db";

const env: Env = {
  DATABASE_URL: "postgres://example",
  BETTER_AUTH_SECRET: "auth-secret",
  BETTER_AUTH_URL: "http://localhost",
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: "test-token",
  TWILIO_FROM_NUMBER: "+15555550999",
  APP_BASE_URL: "http://localhost",
  EXECUTION_TIMEOUT_MS: "5000",
  EXECUTION_MAX_OUTPUT_CHARS: "4000",
};

describe("handleTwilioInbound", () => {
  beforeEach(() => {
    dbClientMock.productionDb = undefined;
    dbClientMock.createPostgresDb.mockClear();
  });

  it("accepts a signed webhook and sends execution results through injected dependencies", async () => {
    const db = createInMemoryDb();
    const sentMessages: string[] = [];
    const pending: Promise<unknown>[] = [];
    const dependencies = createSmsDependencies(db, sentMessages);
    const response = await handleTwilioInbound(
      await signedInboundRequest("SM_TEST_1", 'py print("hi")'),
      env,
      collectWaitUntil(pending),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Running code...");
    await Promise.all(pending);
    expect(db.jobs).toHaveLength(1);
    expect(db.jobs[0]?.language).toBe("python");
    expect(db.messages.filter((message) => message.direction === "outbound")).toHaveLength(1);
    expect(sentMessages).toEqual(["Output:\nhi"]);
  });

  it("treats duplicate MessageSid retries as idempotent", async () => {
    const db = createInMemoryDb();
    const sentMessages: string[] = [];
    const dependencies = createSmsDependencies(db, sentMessages);
    const firstPending: Promise<unknown>[] = [];
    const secondPending: Promise<unknown>[] = [];

    await handleTwilioInbound(
      await signedInboundRequest("SM_DUPLICATE", "py print(1)"),
      env,
      collectWaitUntil(firstPending),
      dependencies,
    );
    await Promise.all(firstPending);
    const duplicateResponse = await handleTwilioInbound(
      await signedInboundRequest("SM_DUPLICATE", "py print(1)"),
      env,
      collectWaitUntil(secondPending),
      dependencies,
    );

    expect(duplicateResponse.status).toBe(200);
    expect(await duplicateResponse.text()).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    );
    expect(secondPending).toHaveLength(0);
    expect(db.jobs).toHaveLength(1);
    expect(sentMessages).toHaveLength(1);
  });

  it("builds the database client from Hyperdrive when dependencies are not injected", async () => {
    const db = createInMemoryDb();
    const pending: Promise<unknown>[] = [];
    dbClientMock.productionDb = db;

    const response = await handleTwilioInbound(
      await signedInboundRequest("SM_PRODUCTION_DB", "help"),
      {
        ...env,
        DATABASE_URL: "postgres://fallback",
        HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
      },
      collectWaitUntil(pending),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Commands:");
    expect(dbClientMock.createPostgresDb).toHaveBeenCalledWith({
      connectionString: "postgres://hyperdrive",
    });
    expect(db.messages).toHaveLength(1);
    expect(pending).toHaveLength(0);
  });

  it("refuses execution for non-allowlisted pilot phone numbers without creating a job", async () => {
    const db = createInMemoryDb();
    const pending: Promise<unknown>[] = [];
    const sentMessages: string[] = [];

    const response = await handleTwilioInbound(
      await signedInboundRequest("SM_NOT_ALLOWED", 'py print("hi")'),
      {
        ...env,
        ENVIRONMENT: "production",
        SMS_ALLOWLIST: "+15555550124",
      },
      collectWaitUntil(pending),
      createSmsDependencies(db, sentMessages),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("not enabled");
    expect(db.jobs).toHaveLength(0);
    expect(sentMessages).toHaveLength(0);
    expect(pending).toHaveLength(0);
  });
});

describe("runExecutionJob", () => {
  it("persists running and terminal lifecycle state through the DB boundary", async () => {
    const db = createInMemoryDb();
    const identity = await db.findOrCreateSmsIdentity("+15555550123");
    const job = await db.createExecutionJob({
      smsIdentityId: identity.id,
      smsMessageId: null,
      language: "python",
      code: 'print("hi")',
      timeoutMs: 5_000,
      maxOutputChars: 4_000,
    });

    const result = await runExecutionJob({ job, identity, db, env });

    expect(result.status).toBe("succeeded");
    expect(result.sandboxId).toBe("sandbox_test");
    expect(db.jobs[0]?.status).toBe("succeeded");
    expect(db.jobs[0]?.startedAt).toBeInstanceOf(Date);
    expect(db.jobs[0]?.finishedAt).toBeInstanceOf(Date);
    expect(db.outputs).toHaveLength(1);
  });
});

/**
 * Creates injectable SMS dependencies used by inbound webhook tests.
 * @param db - In-memory DB boundary for persistence assertions.
 * @param sentMessages - Mutable collection of outbound SMS bodies.
 * @returns Dependencies that avoid real Twilio and sandbox calls.
 */
function createSmsDependencies(db: InMemoryDb, sentMessages: string[]): SmsDependencies {
  return {
    db,
    runJob: async ({ job }) => ({
      status: "succeeded",
      stdout: "hi\n",
      stderr: "",
      exitCode: 0,
      durationMs: 7,
      sandboxId: job.id,
    }),
    sendSms: async ({ body }) => {
      sentMessages.push(body);
      return { providerMessageSid: `SM_OUT_${sentMessages.length}` };
    },
  };
}

/**
 * Captures Worker background tasks for deterministic assertions.
 * @param pending - Mutable promise collection owned by the current test.
 * @returns `waitUntil` implementation compatible with the route handler.
 */
function collectWaitUntil(pending: Promise<unknown>[]): WaitUntil {
  return (promise) => pending.push(promise);
}

/**
 * Builds a signed Twilio webhook request.
 * @param messageSid - Provider message identifier used for idempotency.
 * @param body - Inbound SMS body delivered by Twilio.
 * @returns Request with a valid mocked Twilio signature.
 */
async function signedInboundRequest(messageSid: string, body: string): Promise<Request> {
  const url = "http://localhost/api/twilio/inbound";
  const form = new URLSearchParams({
    From: "+15555550123",
    To: "+15555550999",
    Body: body,
    MessageSid: messageSid,
  });
  const signature = await computeTwilioSignature(url, form, env.TWILIO_AUTH_TOKEN);

  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": signature,
    },
    body: form,
  });
}

/**
 * Computes Twilio's form webhook HMAC for mocked integration requests.
 * @param url - Public webhook URL used by signature validation.
 * @param form - Form fields delivered in the webhook request.
 * @param authToken - Test auth token shared with the handler environment.
 * @returns Base64 HMAC-SHA1 signature.
 */
async function computeTwilioSignature(
  url: string,
  form: URLSearchParams,
  authToken: string,
): Promise<string> {
  const baseString = [...form.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce((accumulator, [key, value]) => `${accumulator}${key}${value}`, url);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(baseString));

  return bytesToBase64(new Uint8Array(digest));
}

/**
 * Encodes binary HMAC output as base64 for Twilio headers.
 * @param bytes - Raw Web Crypto digest bytes.
 * @returns Base64-encoded signature text.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
