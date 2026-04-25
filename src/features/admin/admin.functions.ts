/**
 * @file admin.functions.ts
 * @description Admin server function boundary for dashboard data.
 * @module admin
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";

import { createPostgresDb, type Db } from "../db/client";
import type { ExecutionJob, SmsIdentityUsage, SmsMessage } from "../db/db.types";
import type { Env } from "../../shared/env";
import { requireAdmin } from "../auth/require-admin";
import type {
  AdminDashboardData,
  AdminExecutionView,
  AdminIdentityUsageView,
  AdminMessageView,
} from "./admin.types";

/** Default number of rows shown by MVP admin pages. */
const DEFAULT_ADMIN_LIMIT = 50;

/** Smaller row count used by the dashboard summary cards. */
const DASHBOARD_PREVIEW_LIMIT = 10;

/**
 * Loads the admin dashboard summary.
 * @returns Recent messages, executions, failures, and usage rankings.
 * @remarks Route files call this server function so table queries remain inside
 * feature modules and can later inherit real admin authorization middleware.
 */
export const getAdminDashboardData = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminDashboardData> => {
    await requireAdmin(getRequest(), env as Env);

    const db = createAdminDb();

    return {
      recentMessages: (await db.listRecentSmsMessages(DASHBOARD_PREVIEW_LIMIT)).map(
        toAdminMessageView,
      ),
      recentExecutions: (await db.listRecentExecutionJobs(DASHBOARD_PREVIEW_LIMIT)).map((job) =>
        toAdminExecutionView(job, null),
      ),
      failedExecutions: (await db.listRecentExecutionJobs(DASHBOARD_PREVIEW_LIMIT, "failed")).map(
        (job) => toAdminExecutionView(job, null),
      ),
      topPhoneNumbers: (await db.listSmsIdentityUsage(DASHBOARD_PREVIEW_LIMIT)).map(
        toAdminIdentityUsageView,
      ),
    };
  },
);

/**
 * Loads recent SMS messages for the admin messages page.
 * @returns Recent provider message rows prepared for display.
 */
export const getAdminMessages = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminMessageView[]> => {
    await requireAdmin(getRequest(), env as Env);

    return (await createAdminDb().listRecentSmsMessages(DEFAULT_ADMIN_LIMIT)).map(
      toAdminMessageView,
    );
  },
);

/**
 * Loads recent execution jobs for the admin executions page.
 * @returns Recent execution jobs prepared for display.
 */
export const getAdminExecutions = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminExecutionView[]> => {
    await requireAdmin(getRequest(), env as Env);

    return (await createAdminDb().listRecentExecutionJobs(DEFAULT_ADMIN_LIMIT)).map((job) =>
      toAdminExecutionView(job, null),
    );
  },
);

/**
 * Loads phone identity usage rows for the admin users page.
 * @returns Phone identities ranked by execution usage.
 */
export const getAdminIdentityUsage = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminIdentityUsageView[]> => {
    await requireAdmin(getRequest(), env as Env);

    return (await createAdminDb().listSmsIdentityUsage(DEFAULT_ADMIN_LIMIT)).map(
      toAdminIdentityUsageView,
    );
  },
);

/**
 * Creates the database access layer used by admin server functions.
 * @returns Database boundary backed by the configured Postgres connection.
 * @remarks This reads only database bindings so admin pages do not require
 * Twilio credentials to render.
 */
function createAdminDb(): Db {
  const adminEnv = env as Env;
  const connectionString = adminEnv.HYPERDRIVE?.connectionString ?? adminEnv.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL or HYPERDRIVE binding is required");
  }

  return createPostgresDb({ connectionString });
}

/**
 * Converts a message row into default admin display data.
 * @param message - Stored SMS provider event.
 * @returns Display-safe SMS message view.
 */
function toAdminMessageView(message: SmsMessage): AdminMessageView {
  return {
    id: message.id,
    direction: message.direction,
    maskedPhoneE164: maskPhone(message.phoneE164),
    body: message.body,
    status: message.status,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * Converts an execution job into default admin display data.
 * @param job - Stored execution job row.
 * @param phoneE164 - Optional phone number when available from a joined query.
 * @returns Display-safe execution view.
 */
function toAdminExecutionView(job: ExecutionJob, phoneE164: string | null): AdminExecutionView {
  return {
    id: job.id,
    maskedPhoneE164: phoneE164 ? maskPhone(phoneE164) : null,
    language: job.language,
    code: job.code,
    status: job.status,
    durationMs: job.durationMs,
    errorCode: job.errorCode,
    createdAt: job.createdAt.toISOString(),
  };
}

/**
 * Converts identity usage into default admin display data.
 * @param usage - Aggregated phone identity usage row.
 * @returns Display-safe usage view.
 */
function toAdminIdentityUsageView(usage: SmsIdentityUsage): AdminIdentityUsageView {
  return {
    id: usage.id,
    maskedPhoneE164: maskPhone(usage.phoneE164),
    defaultLanguage: usage.defaultLanguage,
    executionCount: usage.executionCount,
    hourlyLimit: usage.hourlyLimit,
    dailyLimit: usage.dailyLimit,
    disabled: usage.disabled,
    quotaReason: usage.quotaReason,
    lastActiveAt: usage.lastActiveAt?.toISOString() ?? null,
  };
}

/**
 * Masks phone numbers in normal admin UI.
 * @param phoneE164 - Phone number stored for an SMS identity or message.
 * @returns Masked number preserving the country marker and last four digits.
 * @remarks Full phone display should wait for audited, real admin authorization.
 */
function maskPhone(phoneE164: string): string {
  if (phoneE164.length <= 5) {
    return phoneE164;
  }

  return `${phoneE164.slice(0, 2)}${"*".repeat(Math.max(phoneE164.length - 6, 1))}${phoneE164.slice(-4)}`;
}
