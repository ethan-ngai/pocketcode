/**
 * @file sms8-inbound.test.ts
 * @description Integration coverage for SMS8 webhook handling without SMS8 or sandbox execution.
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
import {
  handleDemoSmsAllowlist,
  handleSms8Inbound,
  type WaitUntil,
} from "../../src/features/sms/sms.functions";
import type { SmsDependencies } from "../../src/features/sms/sms.functions";
import { runExecutionJob } from "../../src/features/repl/jobs";
import { createInMemoryDb, type InMemoryDb } from "../helpers/in-memory-db";

const env: Env = {
  DATABASE_URL: "postgres://example",
  BETTER_AUTH_SECRET: "auth-secret",
  BETTER_AUTH_URL: "http://localhost",
  SMS8_API_KEY: "test-key",
  SMS8_DEVICES: '["182|0"]',
  APP_BASE_URL: "http://localhost",
  EXECUTION_TIMEOUT_MS: "5000",
  EXECUTION_MAX_OUTPUT_CHARS: "4000",
};

describe("handleSms8Inbound", () => {
  beforeEach(() => {
    dbClientMock.productionDb = undefined;
    dbClientMock.createPostgresDb.mockClear();
  });

  it("accepts a signed webhook and sends execution results through injected dependencies", async () => {
    const db = createInMemoryDb();
    const sentMessages: string[] = [];
    const pending: Promise<unknown>[] = [];
    const dependencies = createSmsDependencies(db, sentMessages);
    const response = await handleSms8Inbound(
      await signedInboundRequest("SM_TEST_1", 'py print("hi")'),
      env,
      collectWaitUntil(pending),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    await Promise.all(pending);
    expect(db.jobs).toHaveLength(1);
    expect(db.jobs[0]?.language).toBe("python");
    expect(db.messages.filter((message) => message.direction === "outbound")).toHaveLength(1);
    expect(sentMessages).toEqual(["Output:\nhi"]);
  });

  it("accepts SMS8 JSON callbacks and sends execution results", async () => {
    const db = createInMemoryDb();
    const sentMessages: string[] = [];
    const pending: Promise<unknown>[] = [];
    const dependencies = createSmsDependencies(db, sentMessages);
    const response = await handleSms8Inbound(
      await signedInboundRequest("SM_JSON_1", 'py print("hi")', "json"),
      env,
      collectWaitUntil(pending),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    await Promise.all(pending);
    expect(db.jobs).toHaveLength(1);
    expect(sentMessages).toEqual(["Output:\nhi"]);
  });

  it("accepts JSON callbacks signed over the raw messages value", async () => {
    const db = createInMemoryDb();
    const sentMessages: string[] = [];
    const pending: Promise<unknown>[] = [];
    const dependencies = createSmsDependencies(db, sentMessages);
    const response = await handleSms8Inbound(
      await signedInboundRequest("SM_JSON_RAW_1", 'py print("hi")', "json_raw_messages"),
      env,
      collectWaitUntil(pending),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    await Promise.all(pending);
    expect(db.jobs).toHaveLength(1);
    expect(sentMessages).toEqual(["Output:\nhi"]);
  });

  it("accepts JSON callbacks where the body is the messages array", async () => {
    const db = createInMemoryDb();
    const sentMessages: string[] = [];
    const pending: Promise<unknown>[] = [];
    const dependencies = createSmsDependencies(db, sentMessages);
    const response = await handleSms8Inbound(
      await signedInboundRequest("SM_JSON_ARRAY_1", 'py print("hi")', "json_array"),
      env,
      collectWaitUntil(pending),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    await Promise.all(pending);
    expect(db.jobs).toHaveLength(1);
    expect(sentMessages).toEqual(["Output:\nhi"]);
  });

  it("accepts JSON callbacks where the body is one message object", async () => {
    const db = createInMemoryDb();
    const sentMessages: string[] = [];
    const pending: Promise<unknown>[] = [];
    const dependencies = createSmsDependencies(db, sentMessages);
    const response = await handleSms8Inbound(
      await signedInboundRequest("SM_JSON_OBJECT_1", 'py print("hi")', "json_object"),
      env,
      collectWaitUntil(pending),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    await Promise.all(pending);
    expect(db.jobs).toHaveLength(1);
    expect(sentMessages).toEqual(["Output:\nhi"]);
  });

  it("treats duplicate SMS8 message IDs as idempotent", async () => {
    const db = createInMemoryDb();
    const sentMessages: string[] = [];
    const dependencies = createSmsDependencies(db, sentMessages);
    const firstPending: Promise<unknown>[] = [];
    const secondPending: Promise<unknown>[] = [];

    await handleSms8Inbound(
      await signedInboundRequest("SM_DUPLICATE", "py print(1)"),
      env,
      collectWaitUntil(firstPending),
      dependencies,
    );
    await Promise.all(firstPending);
    const duplicateResponse = await handleSms8Inbound(
      await signedInboundRequest("SM_DUPLICATE", "py print(1)"),
      env,
      collectWaitUntil(secondPending),
      dependencies,
    );

    expect(duplicateResponse.status).toBe(200);
    expect(await duplicateResponse.text()).toBe("OK");
    expect(secondPending).toHaveLength(0);
    expect(db.jobs).toHaveLength(1);
    expect(sentMessages).toHaveLength(1);
  });

  it("builds the database client from Hyperdrive when dependencies are not injected", async () => {
    const db = createInMemoryDb();
    const pending: Promise<unknown>[] = [];
    dbClientMock.productionDb = db;
    await db.insertInboundSms({
      direction: "inbound",
      providerMessageSid: "SM_PRODUCTION_DB",
      phoneE164: "+15555550123",
      body: "help",
      status: "received",
      rawPayload: {},
    });

    const response = await handleSms8Inbound(
      await signedInboundRequest("SM_PRODUCTION_DB", "help"),
      {
        ...env,
        DATABASE_URL: "postgres://fallback",
        HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
      },
      collectWaitUntil(pending),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    await Promise.all(pending);
    expect(dbClientMock.createPostgresDb).toHaveBeenCalledWith({
      connectionString: "postgres://hyperdrive",
    });
    expect(pending).toHaveLength(0);
    expect(db.messages).toHaveLength(1);
  });

  it("refuses execution for non-allowlisted pilot phone numbers without creating a job", async () => {
    const db = createInMemoryDb();
    const pending: Promise<unknown>[] = [];
    const sentMessages: string[] = [];

    const response = await handleSms8Inbound(
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
    expect(await response.text()).toBe("OK");
    await Promise.all(pending);
    expect(db.jobs).toHaveLength(0);
    expect(sentMessages).toEqual(["This phone number is not enabled for the SMS pilot."]);
  });

  it("allows production SMS execution for identities added through the demo allowlist", async () => {
    const db = createInMemoryDb();
    const pending: Promise<unknown>[] = [];
    const sentMessages: string[] = [];
    const allowlistResponse = await handleDemoSmsAllowlist(
      jsonRequest("/api/demo/sms-allowlist", { phoneE164: "+15555550123" }),
      env,
      { db },
    );

    expect(allowlistResponse.status).toBe(200);
    expect(await allowlistResponse.json()).toEqual({
      allowed: true,
      phoneE164: "+15555550123",
    });

    const response = await handleSms8Inbound(
      await signedInboundRequest("SM_DYNAMIC_ALLOWED", 'py print("hi")'),
      {
        ...env,
        ENVIRONMENT: "production",
        SMS_ALLOWLIST: "+15555550124",
      },
      collectWaitUntil(pending),
      createSmsDependencies(db, sentMessages),
    );

    expect(response.status).toBe(200);
    await Promise.all(pending);
    expect(db.jobs).toHaveLength(1);
    expect(sentMessages).toEqual(["Output:\nhi"]);
  });

  it("accepts unsigned webhooks when SMS8 webhook auth is explicitly disabled", async () => {
    const db = createInMemoryDb();
    const sentMessages: string[] = [];
    const pending: Promise<unknown>[] = [];
    const response = await handleSms8Inbound(
      await unsignedInboundRequest("SM_UNSIGNED", 'py print("hi")'),
      {
        ...env,
        SMS8_WEBHOOK_AUTH_ENABLED: "false",
      },
      collectWaitUntil(pending),
      createSmsDependencies(db, sentMessages),
    );

    expect(response.status).toBe(200);
    await Promise.all(pending);
    expect(db.jobs).toHaveLength(1);
    expect(sentMessages).toEqual(["Output:\nhi"]);
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
 * @returns Dependencies that avoid real SMS8 and sandbox calls.
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
 * Builds a JSON request for feature handlers under test.
 * @param path - Route path appended to the local test origin.
 * @param body - JSON payload to serialize into the request.
 * @returns Request carrying a JSON content type.
 */
function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Builds a signed SMS8 webhook request.
 * @param messageId - Provider message identifier used for idempotency.
 * @param body - Inbound SMS body delivered by SMS8.
 * @returns Request with a valid mocked SMS8 signature.
 */
async function signedInboundRequest(
  messageId: string,
  body: string,
  contentType: "form" | "json" | "json_raw_messages" | "json_array" | "json_object" = "form",
): Promise<Request> {
  const url = "http://localhost/api/sms8/inbound";
  const messageRecords = [
    {
      ID: messageId,
      number: "+15555550123",
      message: body,
      deviceID: "182",
      simSlot: "0",
      userID: "1",
      status: "Received",
      sentDate: "2026-04-25T12:00:00+00:00",
      deliveredDate: "2026-04-25T12:00:01+00:00",
      groupID: null,
    },
  ];
  const messages = JSON.stringify(messageRecords);
  const signature = await computeSms8Signature(messages, env.SMS8_API_KEY);

  if (contentType === "json_object") {
    const rawMessage = JSON.stringify(messageRecords[0]);
    const rawSignature = await computeSms8Signature(rawMessage, env.SMS8_API_KEY);

    return new Request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sg-signature": rawSignature,
      },
      body: rawMessage,
    });
  }

  if (contentType === "json_array") {
    return new Request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sg-signature": signature,
      },
      body: messages,
    });
  }

  if (contentType === "json_raw_messages") {
    const rawMessages = JSON.stringify(messageRecords, null, 2);
    const rawSignature = await computeSms8Signature(rawMessages, env.SMS8_API_KEY);

    return new Request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sg-signature": rawSignature,
      },
      body: `{\n  "messages": ${rawMessages}\n}`,
    });
  }

  if (contentType === "json") {
    return new Request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sg-signature": signature,
      },
      body: JSON.stringify({ messages: messageRecords }),
    });
  }

  const form = new URLSearchParams({ messages });

  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-sg-signature": signature,
    },
    body: form,
  });
}

/**
 * Builds an unsigned form webhook request for optional-auth deployments.
 * @param messageId - Provider message identifier used for idempotency.
 * @param body - Inbound SMS body delivered by SMS8.
 * @returns Request without an SMS8 signature header.
 */
function unsignedInboundRequest(messageId: string, body: string): Request {
  const messages = JSON.stringify([
    {
      ID: messageId,
      number: "+15555550123",
      message: body,
      deviceID: "182",
      simSlot: "0",
      userID: "1",
      status: "Received",
      sentDate: "2026-04-25T12:00:00+00:00",
      deliveredDate: "2026-04-25T12:00:01+00:00",
      groupID: null,
    },
  ]);

  return new Request("http://localhost/api/sms8/inbound", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ messages }),
  });
}

/**
 * Computes SMS8's messages-field HMAC for mocked integration requests.
 * @param messagesJson - Raw JSON text from the `messages` form field.
 * @param apiKey - Test API key shared with the handler environment.
 * @returns Base64 HMAC-SHA256 signature.
 */
async function computeSms8Signature(messagesJson: string, apiKey: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(messagesJson));

  return bytesToBase64(new Uint8Array(digest));
}

/**
 * Encodes binary HMAC output as base64 for SMS8 headers.
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
