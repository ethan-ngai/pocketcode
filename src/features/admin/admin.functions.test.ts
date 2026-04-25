/**
 * @file admin.functions.test.ts
 * @description Unit coverage for admin server-function authorization boundaries.
 * @module admin
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "../db/client";
import type { Env } from "../../shared/env";

const testState = vi.hoisted(() => {
  const env: Env = {
    DATABASE_URL: "postgres://admin",
    BETTER_AUTH_SECRET: "auth-secret",
    BETTER_AUTH_URL: "http://localhost",
    SMS8_API_KEY: "sms8-key",
    SMS8_DEVICES: '["182|0"]',
    APP_BASE_URL: "http://localhost",
  };
  const request = new Request("http://localhost/app/admin/messages");

  return {
    env,
    request,
    createPostgresDb: vi.fn(),
    requireAdmin: vi.fn(),
  };
});

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    handler: <T>(callback: T) => callback,
  }),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => testState.request,
}));

vi.mock("cloudflare:workers", () => ({
  env: testState.env,
}));

vi.mock("../auth/require-admin", () => ({
  requireAdmin: testState.requireAdmin,
}));

vi.mock("../db/client", () => ({
  createPostgresDb: testState.createPostgresDb,
}));

import {
  getAdminDashboardData,
  getAdminExecutions,
  getAdminIdentityUsage,
  getAdminMessages,
} from "./admin.functions";

describe("admin server functions", () => {
  beforeEach(() => {
    testState.createPostgresDb.mockReset();
    testState.requireAdmin.mockReset();
    testState.createPostgresDb.mockReturnValue(createFailingDb());
  });

  it("rejects unauthenticated dashboard data requests before database reads", async () => {
    const error = new Error("Authentication is required.");
    testState.requireAdmin.mockRejectedValue(error);

    await expect(getAdminDashboardData()).rejects.toThrow("Authentication is required.");
    expect(testState.requireAdmin).toHaveBeenCalledWith(testState.request, testState.env);
    expect(testState.createPostgresDb).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated admin list requests before database reads", async () => {
    const error = new Error("Authentication is required.");
    testState.requireAdmin.mockRejectedValue(error);

    await expect(getAdminMessages()).rejects.toThrow("Authentication is required.");
    await expect(getAdminExecutions()).rejects.toThrow("Authentication is required.");
    await expect(getAdminIdentityUsage()).rejects.toThrow("Authentication is required.");
    expect(testState.createPostgresDb).not.toHaveBeenCalled();
  });
});

/**
 * Creates a DB stub that fails if authorization stops being first.
 * @returns Database boundary whose methods should never be reached in rejection tests.
 */
function createFailingDb(): Db {
  const fail = async () => {
    throw new Error("database should not be read before admin authorization");
  };

  return {
    findOrCreateSmsIdentity: fail,
    findSmsMessageByProviderSid: fail,
    insertInboundSms: fail,
    insertOutboundSms: fail,
    updateSmsStatus: fail,
    createExecutionJob: fail,
    markExecutionRunning: fail,
    finishExecutionJob: fail,
    getActiveSession: fail,
    upsertSessionLanguage: fail,
    recordSessionExecution: fail,
    resetActiveSession: fail,
    countExecutionsForPhone: fail,
    getSmsQuota: fail,
    upsertSmsQuota: fail,
    listRecentSmsMessages: fail,
    listRecentExecutionJobs: fail,
    listSmsIdentityUsage: fail,
  };
}
