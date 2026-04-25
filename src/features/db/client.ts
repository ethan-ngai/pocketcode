/**
 * @file client.ts
 * @description Database access boundary consumed by SMS and REPL features.
 * @module db
 */
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { ExecutionResult, ExecutionStatus, ReplLanguage } from "../repl/repl.types";
import { createId } from "../../shared/ids";
import type { AppConfig } from "../../shared/env";
import type {
  ExecutionJob,
  ReplSession,
  SmsIdentity,
  SmsIdentityUsage,
  SmsMessage,
  SmsQuota,
} from "./db.types";
import * as schema from "./schema";

/**
 * Concrete Drizzle client type for this schema.
 * @remarks Keeping the ORM type private to this module preserves the stable
 * `Db` API that parallel SMS and sandbox workstreams depend on.
 */
type DatabaseClient = PostgresJsDatabase<typeof schema>;

/**
 * Input required to persist an SMS message.
 * @remarks The database implementation maps camelCase fields to the final
 * schema while callers stay independent of ORM naming conventions.
 */
export interface InsertSmsMessage {
  /** Inbound or outbound message direction. */
  direction: "inbound" | "outbound";
  /** Provider message id for idempotency when available. */
  providerMessageSid: string | null;
  /** Phone number associated with the message. */
  phoneE164: string;
  /** User-visible body when present. */
  body: string | null;
  /** Provider status when present. */
  status: string | null;
  /** Raw provider payload retained for debugging and audits. */
  rawPayload: unknown;
}

/**
 * Input required to update a provider SMS delivery callback.
 * @remarks Status callbacks may arrive before or after local outbound
 * persistence, so provider SID remains the stable correlation key.
 */
export interface UpdateSmsStatusInput {
  /** Provider message id reported by delivery callbacks. */
  providerMessageSid: string;
  /** Delivery lifecycle value reported by the provider. */
  status: string;
  /** Raw provider callback retained for debugging and audits. */
  rawPayload: unknown;
}

/**
 * Input required to create a queued execution job.
 * @remarks SMS and admin callers share this shape so sandbox orchestration does
 * not need to know which user surface created the job.
 */
export interface CreateExecutionJobInput {
  /** Source SMS message id, if the job originated from SMS. */
  smsMessageId: string | null;
  /** SMS identity id that owns the execution context. */
  smsIdentityId: string | null;
  /** Runtime selected for execution. */
  language: ReplLanguage;
  /** Source code to execute. */
  code: string;
  /** Timeout budget captured at enqueue time. */
  timeoutMs: number;
  /** Output budget captured at enqueue time. */
  maxOutputChars: number;
}

/**
 * Input for support-owned SMS quota changes.
 * @remarks Limits are optional so admin actions can disable a number without
 * unintentionally changing its execution budget.
 */
export interface UpsertSmsQuotaInput {
  /** E.164 phone number used as the quota key. */
  phoneE164: string;
  /** Hourly execution limit when overriding the default policy. */
  hourlyLimit?: number;
  /** Daily execution limit when overriding the default policy. */
  dailyLimit?: number;
  /** Whether the number is blocked before sandbox job creation. */
  disabled?: boolean;
  /** Support-facing note explaining the current override. */
  reason?: string | null;
}

/**
 * Database API promised to SMS, REPL, and admin workstreams.
 * @remarks Implementations can use Hyperdrive, Neon, and Drizzle details behind
 * this interface without forcing feature teams to coordinate on schema internals.
 */
export interface Db {
  /**
   * Finds or creates an SMS identity for a phone number.
   * @param phoneE164 - Sender phone number already normalized to E.164.
   * @returns Existing or newly created SMS identity.
   */
  findOrCreateSmsIdentity(phoneE164: string): Promise<SmsIdentity>;

  /**
   * Looks up a provider message by id for idempotent webhook handling.
   * @param providerMessageSid - Provider message id reported by inbound or outbound APIs.
   * @returns Stored message row when this provider event has already been seen.
   */
  findSmsMessageByProviderSid(providerMessageSid: string): Promise<SmsMessage | null>;

  /**
   * Persists a provider SMS event.
   * @param input - Normalized message payload from the SMS feature.
   * @returns Stored message row.
   */
  insertInboundSms(input: InsertSmsMessage): Promise<SmsMessage>;

  /**
   * Persists an outbound provider SMS event.
   * @param input - Normalized outbound message payload from the SMS feature.
   * @returns Stored outbound message row.
   */
  insertOutboundSms(input: InsertSmsMessage): Promise<SmsMessage>;

  /**
   * Updates delivery status for a provider message.
   * @param input - Provider callback fields keyed by message SID.
   * @returns Promise that resolves once the status callback is persisted.
   */
  updateSmsStatus(input: UpdateSmsStatusInput): Promise<void>;

  /**
   * Creates an execution job in the queued state.
   * @param input - Stable job creation data from SMS or admin surfaces.
   * @returns Stored execution job row.
   */
  createExecutionJob(input: CreateExecutionJobInput): Promise<ExecutionJob>;

  /**
   * Marks a queued job as running.
   * @param id - Execution job id.
   * @param sandboxId - Provider sandbox id when allocated.
   * @returns Promise that resolves once the transition is persisted.
   */
  markExecutionRunning(id: string, sandboxId?: string): Promise<void>;

  /**
   * Persists terminal execution state and output.
   * @param id - Execution job id.
   * @param result - Normalized sandbox result.
   * @returns Promise that resolves once lifecycle and output rows are persisted.
   */
  finishExecutionJob(id: string, result: ExecutionResult): Promise<void>;

  /**
   * Reads the active REPL session for an SMS identity.
   * @param identityId - SMS identity id.
   * @returns Active session or null when the user has no active state.
   */
  getActiveSession(identityId: string): Promise<ReplSession | null>;

  /**
   * Updates or creates the default session language for an SMS identity.
   * @param identityId - SMS identity id.
   * @param language - Language selected through SMS commands.
   * @returns Promise that resolves when the session state is persisted.
   */
  upsertSessionLanguage(identityId: string, language: ReplLanguage): Promise<void>;

  /**
   * Records the newest execution in active SMS session state.
   * @param identityId - SMS identity id selected by the sender phone number.
   * @param language - Runtime used for the execution.
   * @param jobId - Execution job id to expose as last activity.
   * @returns Promise that resolves once session state has been updated.
   */
  recordSessionExecution(identityId: string, language: ReplLanguage, jobId: string): Promise<void>;

  /**
   * Clears active session state for an SMS identity.
   * @param identityId - SMS identity id selected by the sender phone number.
   * @returns Promise that resolves once active state has been reset.
   */
  resetActiveSession(identityId: string): Promise<void>;

  /**
   * Counts executions for a phone number since a point in time.
   * @param phoneE164 - Sender phone number already normalized to E.164.
   * @param since - Inclusive lower bound used for hourly or daily windows.
   * @returns Number of execution jobs created in the requested window.
   */
  countExecutionsForPhone(phoneE164: string, since: Date): Promise<number>;

  /**
   * Reads a per-phone SMS quota override.
   * @param phoneE164 - Sender phone number already normalized to E.164.
   * @returns Quota override row or null when defaults apply.
   */
  getSmsQuota(phoneE164: string): Promise<SmsQuota | null>;

  /**
   * Creates or updates a per-phone SMS quota override.
   * @param input - Support-owned quota or disable action.
   * @returns Stored quota row after defaults and updates are applied.
   */
  upsertSmsQuota(input: UpsertSmsQuotaInput): Promise<SmsQuota>;

  /**
   * Lists recent provider SMS events for admin inspection.
   * @param limit - Maximum number of rows to return.
   * @returns Messages ordered by creation time descending.
   */
  listRecentSmsMessages(limit: number): Promise<SmsMessage[]>;

  /**
   * Lists recent execution jobs for admin inspection.
   * @param limit - Maximum number of rows to return.
   * @param status - Optional lifecycle status filter, used for failed-job views.
   * @returns Execution jobs ordered by creation time descending.
   */
  listRecentExecutionJobs(limit: number, status?: ExecutionStatus): Promise<ExecutionJob[]>;

  /**
   * Lists phone identities ordered by execution usage.
   * @param limit - Maximum number of rows to return.
   * @returns Usage aggregates for dashboard ranking.
   */
  listSmsIdentityUsage(limit: number): Promise<SmsIdentityUsage[]>;
}

/**
 * Options for creating a Postgres-backed DB access layer.
 * @remarks Callers pass a connection string from Hyperdrive or Neon rather than
 * letting database code reach into Worker globals.
 */
export interface CreatePostgresDbOptions {
  /** Postgres connection string from Hyperdrive or direct Neon configuration. */
  connectionString: string;
  /** Maximum connections opened by this Worker isolate. */
  maxConnections?: number;
}

/**
 * Creates a DB access layer from normalized application config.
 * @param config - Parsed Worker configuration for the current request context.
 * @returns Stable database API for feature modules.
 * @remarks This helper keeps route code aligned with `getAppConfig` while the
 * lower-level factory remains useful for integration tests.
 */
export function createDbFromConfig(config: Pick<AppConfig, "databaseUrl">): Db {
  return createPostgresDb({ connectionString: config.databaseUrl });
}

/**
 * Creates a Postgres-backed database access layer.
 * @param options - Connection details supplied by the Worker runtime or tests.
 * @returns Stable database API for SMS, REPL, and admin features.
 * @remarks Prepared statements are disabled because Hyperdrive and pooled Neon
 * connections should not rely on per-connection prepared statement state.
 */
export function createPostgresDb(options: CreatePostgresDbOptions): Db {
  const queryClient = postgres(options.connectionString, {
    max: options.maxConnections ?? 5,
    prepare: false,
  });
  const db = drizzle(queryClient, { schema });

  return createDrizzleDb(db);
}

/**
 * Wraps a Drizzle client in the feature-level DB contract.
 * @param db - Drizzle database bound to the app schema.
 * @returns Stable database API.
 * @remarks Exporting this seam gives tests a way to use transactions or test
 * databases without making production code expose table objects.
 */
export function createDrizzleDb(db: DatabaseClient): Db {
  return {
    async findOrCreateSmsIdentity(phoneE164) {
      const inserted = await db
        .insert(schema.smsIdentities)
        .values({
          id: createId("smsid"),
          phoneE164,
        })
        .onConflictDoNothing({ target: schema.smsIdentities.phoneE164 })
        .returning();

      if (inserted[0]) {
        return toSmsIdentity(inserted[0]);
      }

      const existing = await db
        .select()
        .from(schema.smsIdentities)
        .where(eq(schema.smsIdentities.phoneE164, phoneE164))
        .limit(1);

      if (!existing[0]) {
        throw new Error("Failed to find or create SMS identity");
      }

      return toSmsIdentity(existing[0]);
    },

    async findSmsMessageByProviderSid(providerMessageSid) {
      const messages = await db
        .select()
        .from(schema.smsMessages)
        .where(eq(schema.smsMessages.providerMessageSid, providerMessageSid))
        .limit(1);

      return messages[0] ? toSmsMessage(messages[0]) : null;
    },

    async insertInboundSms(input) {
      const inserted = await db
        .insert(schema.smsMessages)
        .values({
          id: createId("sms"),
          direction: input.direction,
          providerMessageSid: input.providerMessageSid,
          phoneE164: input.phoneE164,
          body: input.body,
          status: input.status,
          rawPayload: input.rawPayload,
        })
        .onConflictDoNothing({
          target: schema.smsMessages.providerMessageSid,
        })
        .returning();

      if (inserted[0]) {
        return toSmsMessage(inserted[0]);
      }

      if (!input.providerMessageSid) {
        throw new Error("Failed to insert SMS message");
      }

      const existing = await db
        .select()
        .from(schema.smsMessages)
        .where(eq(schema.smsMessages.providerMessageSid, input.providerMessageSid))
        .limit(1);

      if (!existing[0]) {
        throw new Error("Failed to resolve duplicate SMS message");
      }

      return toSmsMessage(existing[0]);
    },

    async insertOutboundSms(input) {
      const inserted = await db
        .insert(schema.smsMessages)
        .values({
          id: createId("sms"),
          direction: input.direction,
          providerMessageSid: input.providerMessageSid,
          phoneE164: input.phoneE164,
          body: input.body,
          status: input.status,
          rawPayload: input.rawPayload,
        })
        .onConflictDoNothing({
          target: schema.smsMessages.providerMessageSid,
        })
        .returning();

      if (inserted[0]) {
        return toSmsMessage(inserted[0]);
      }

      if (!input.providerMessageSid) {
        throw new Error("Failed to insert outbound SMS message");
      }

      const existing = await db
        .select()
        .from(schema.smsMessages)
        .where(eq(schema.smsMessages.providerMessageSid, input.providerMessageSid))
        .limit(1);

      if (!existing[0]) {
        throw new Error("Failed to resolve duplicate outbound SMS message");
      }

      return toSmsMessage(existing[0]);
    },

    async updateSmsStatus(input) {
      const updated = await db
        .update(schema.smsMessages)
        .set({
          status: input.status,
          rawPayload: input.rawPayload,
        })
        .where(eq(schema.smsMessages.providerMessageSid, input.providerMessageSid))
        .returning({ id: schema.smsMessages.id });

      if (!updated[0]) {
        throw new Error(`SMS message ${input.providerMessageSid} does not exist`);
      }
    },

    async createExecutionJob(input) {
      const inserted = await db
        .insert(schema.executionJobs)
        .values({
          id: createId("job"),
          smsMessageId: input.smsMessageId,
          smsIdentityId: input.smsIdentityId,
          language: input.language,
          code: input.code,
          status: "queued",
          timeoutMs: input.timeoutMs,
          maxOutputChars: input.maxOutputChars,
        })
        .returning();

      if (!inserted[0]) {
        throw new Error("Failed to create execution job");
      }

      return toExecutionJob(inserted[0]);
    },

    async markExecutionRunning(id, sandboxId) {
      const updated = await db
        .update(schema.executionJobs)
        .set({
          status: "running",
          sandboxId: sandboxId ?? null,
          startedAt: new Date(),
        })
        .where(and(eq(schema.executionJobs.id, id), eq(schema.executionJobs.status, "queued")))
        .returning({ id: schema.executionJobs.id });

      if (!updated[0]) {
        throw new Error(`Execution job ${id} is not queued or does not exist`);
      }
    },

    async finishExecutionJob(id, result) {
      await db.transaction(async (tx) => {
        const finishedAt = new Date();
        const updated = await tx
          .update(schema.executionJobs)
          .set({
            status: result.status,
            sandboxId: result.sandboxId,
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            errorCode: result.errorCode,
            finishedAt,
          })
          .where(eq(schema.executionJobs.id, id))
          .returning({
            id: schema.executionJobs.id,
            maxOutputChars: schema.executionJobs.maxOutputChars,
          });

        if (!updated[0]) {
          throw new Error(`Execution job ${id} does not exist`);
        }

        const combinedOutput = joinOutput(result.stdout, result.stderr);
        const combinedPreview = combinedOutput.slice(0, updated[0].maxOutputChars);

        await tx.insert(schema.executionOutputs).values({
          id: createId("out"),
          executionJobId: id,
          stdout: result.stdout,
          stderr: result.stderr,
          combinedPreview,
          wasTruncated: combinedOutput.length > combinedPreview.length,
        });
      });
    },

    async getActiveSession(identityId) {
      const sessions = await db
        .select()
        .from(schema.replSessions)
        .where(
          and(
            eq(schema.replSessions.smsIdentityId, identityId),
            eq(schema.replSessions.status, "active"),
          ),
        )
        .orderBy(desc(schema.replSessions.lastActiveAt))
        .limit(1);

      return sessions[0] ? toReplSession(sessions[0]) : null;
    },

    async upsertSessionLanguage(identityId, language) {
      const now = new Date();

      await db
        .insert(schema.replSessions)
        .values({
          id: createId("sess"),
          smsIdentityId: identityId,
          language,
          status: "active",
          state: {
            defaultLanguage: language,
            lastActiveAt: now.toISOString(),
          },
          lastActiveAt: now,
        })
        .onConflictDoUpdate({
          target: schema.replSessions.smsIdentityId,
          targetWhere: eq(schema.replSessions.status, "active"),
          set: {
            language,
            state: {
              defaultLanguage: language,
              lastActiveAt: now.toISOString(),
            },
            lastActiveAt: now,
          },
        });
    },

    async recordSessionExecution(identityId, language, jobId) {
      const now = new Date();

      await db
        .insert(schema.replSessions)
        .values({
          id: createId("sess"),
          smsIdentityId: identityId,
          language,
          status: "active",
          state: {
            defaultLanguage: language,
            lastExecutionJobId: jobId,
            lastActiveAt: now.toISOString(),
          },
          lastActiveAt: now,
        })
        .onConflictDoUpdate({
          target: schema.replSessions.smsIdentityId,
          targetWhere: eq(schema.replSessions.status, "active"),
          set: {
            language,
            state: {
              defaultLanguage: language,
              lastExecutionJobId: jobId,
              lastActiveAt: now.toISOString(),
            },
            lastActiveAt: now,
          },
        });
    },

    async resetActiveSession(identityId) {
      await db
        .update(schema.replSessions)
        .set({
          status: "reset",
          state: {},
          lastActiveAt: new Date(),
        })
        .where(
          and(
            eq(schema.replSessions.smsIdentityId, identityId),
            eq(schema.replSessions.status, "active"),
          ),
        );
    },

    async countExecutionsForPhone(phoneE164, since) {
      const rows = await db
        .select({ value: count() })
        .from(schema.executionJobs)
        .innerJoin(
          schema.smsIdentities,
          eq(schema.executionJobs.smsIdentityId, schema.smsIdentities.id),
        )
        .where(
          and(
            eq(schema.smsIdentities.phoneE164, phoneE164),
            gte(schema.executionJobs.createdAt, since),
          ),
        )
        .limit(1);

      return Number(rows[0]?.value ?? 0);
    },

    async getSmsQuota(phoneE164) {
      const rows = await db
        .select()
        .from(schema.smsQuotas)
        .where(eq(schema.smsQuotas.phoneE164, phoneE164))
        .limit(1);

      return rows[0] ? toSmsQuota(rows[0]) : null;
    },

    async upsertSmsQuota(input) {
      const inserted = await db
        .insert(schema.smsQuotas)
        .values({
          phoneE164: input.phoneE164,
          hourlyLimit: input.hourlyLimit,
          dailyLimit: input.dailyLimit,
          disabled: input.disabled,
          reason: input.reason,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.smsQuotas.phoneE164,
          set: {
            hourlyLimit:
              input.hourlyLimit === undefined
                ? sql`${schema.smsQuotas.hourlyLimit}`
                : input.hourlyLimit,
            dailyLimit:
              input.dailyLimit === undefined
                ? sql`${schema.smsQuotas.dailyLimit}`
                : input.dailyLimit,
            disabled:
              input.disabled === undefined ? sql`${schema.smsQuotas.disabled}` : input.disabled,
            reason: input.reason === undefined ? sql`${schema.smsQuotas.reason}` : input.reason,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!inserted[0]) {
        throw new Error("Failed to upsert SMS quota");
      }

      return toSmsQuota(inserted[0]);
    },

    async listRecentSmsMessages(limit) {
      const messages = await db
        .select()
        .from(schema.smsMessages)
        .orderBy(desc(schema.smsMessages.createdAt))
        .limit(limit);

      return messages.map(toSmsMessage);
    },

    async listRecentExecutionJobs(limit, status) {
      const query = db
        .select()
        .from(schema.executionJobs)
        .orderBy(desc(schema.executionJobs.createdAt))
        .limit(limit);

      if (!status) {
        return (await query).map(toExecutionJob);
      }

      const jobs = await db
        .select()
        .from(schema.executionJobs)
        .where(eq(schema.executionJobs.status, status))
        .orderBy(desc(schema.executionJobs.createdAt))
        .limit(limit);

      return jobs.map(toExecutionJob);
    },

    async listSmsIdentityUsage(limit) {
      const rows = await db
        .select({
          id: schema.smsIdentities.id,
          phoneE164: schema.smsIdentities.phoneE164,
          defaultLanguage: schema.smsIdentities.defaultLanguage,
          hourlyLimit: sql<number>`coalesce(${schema.smsQuotas.hourlyLimit}, 20)`,
          dailyLimit: sql<number>`coalesce(${schema.smsQuotas.dailyLimit}, 100)`,
          disabled: sql<boolean>`coalesce(${schema.smsQuotas.disabled}, false)`,
          quotaReason: schema.smsQuotas.reason,
          executionCount: count(schema.executionJobs.id),
          lastActiveAt: sql<Date | null>`max(${schema.replSessions.lastActiveAt})`,
        })
        .from(schema.smsIdentities)
        .leftJoin(schema.smsQuotas, eq(schema.smsQuotas.phoneE164, schema.smsIdentities.phoneE164))
        .leftJoin(
          schema.executionJobs,
          eq(schema.executionJobs.smsIdentityId, schema.smsIdentities.id),
        )
        .leftJoin(
          schema.replSessions,
          eq(schema.replSessions.smsIdentityId, schema.smsIdentities.id),
        )
        .groupBy(
          schema.smsIdentities.id,
          schema.smsIdentities.phoneE164,
          schema.smsIdentities.defaultLanguage,
          schema.smsQuotas.hourlyLimit,
          schema.smsQuotas.dailyLimit,
          schema.smsQuotas.disabled,
          schema.smsQuotas.reason,
        )
        .orderBy(desc(count(schema.executionJobs.id)))
        .limit(limit);

      return rows.map((row) => ({
        ...row,
        defaultLanguage: row.defaultLanguage as ReplLanguage,
        executionCount: Number(row.executionCount),
        hourlyLimit: Number(row.hourlyLimit),
        dailyLimit: Number(row.dailyLimit),
        disabled: Boolean(row.disabled),
        quotaReason: row.quotaReason,
      }));
    },
  };
}

/**
 * Converts separated streams into the preview shape used by SMS and admin UI.
 * @param stdout - Captured standard output.
 * @param stderr - Captured standard error.
 * @returns Combined stream preview text.
 * @remarks A small label on stderr preserves enough context for SMS previews
 * without requiring the egress feature to understand separate streams.
 */
function joinOutput(stdout: string, stderr: string): string {
  if (!stderr) {
    return stdout;
  }

  if (!stdout) {
    return stderr;
  }

  return `${stdout}\n${stderr}`;
}

/**
 * Maps an ORM identity row to the stable feature contract.
 * @param row - Drizzle-selected SMS identity row.
 * @returns Domain-level SMS identity.
 * @remarks Database check constraints enforce the runtime language union; this
 * cast keeps that invariant at the feature boundary.
 */
function toSmsIdentity(row: typeof schema.smsIdentities.$inferSelect): SmsIdentity {
  return {
    ...row,
    defaultLanguage: row.defaultLanguage as ReplLanguage,
  };
}

/**
 * Maps an ORM message row to the stable feature contract.
 * @param row - Drizzle-selected SMS message row.
 * @returns Domain-level SMS message.
 * @remarks Provider and direction are narrowed here so callers do not repeat
 * database constraint knowledge in every feature.
 */
function toSmsMessage(row: typeof schema.smsMessages.$inferSelect): SmsMessage {
  return {
    ...row,
    direction: row.direction as SmsMessage["direction"],
    provider: row.provider as SmsMessage["provider"],
  };
}

/**
 * Maps an ORM quota row to the stable feature contract.
 * @param row - Drizzle-selected SMS quota row.
 * @returns Domain-level SMS quota.
 * @remarks Keeping this mapping here lets security code depend on one contract
 * while migration defaults remain table-owned.
 */
function toSmsQuota(row: typeof schema.smsQuotas.$inferSelect): SmsQuota {
  return row;
}

/**
 * Maps an ORM execution job row to the stable feature contract.
 * @param row - Drizzle-selected execution job row.
 * @returns Domain-level execution job.
 * @remarks Lifecycle and language unions are guaranteed by table checks and are
 * narrowed once at the DB boundary.
 */
function toExecutionJob(row: typeof schema.executionJobs.$inferSelect): ExecutionJob {
  return {
    ...row,
    language: row.language as ExecutionJob["language"],
    status: row.status as ExecutionJob["status"],
  };
}

/**
 * Maps an ORM session row to the stable feature contract.
 * @param row - Drizzle-selected REPL session row.
 * @returns Domain-level active session.
 * @remarks The language cast is centralized with other schema-backed unions.
 */
function toReplSession(row: typeof schema.replSessions.$inferSelect): ReplSession {
  return {
    ...row,
    language: row.language as ReplLanguage,
  };
}
