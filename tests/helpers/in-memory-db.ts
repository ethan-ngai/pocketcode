/**
 * @file in-memory-db.ts
 * @description In-memory implementation of the feature DB contract for tests.
 * @module tests
 */
import type { Db, InsertSmsMessage } from "../../src/features/db/client";
import type {
  ExecutionJob,
  ReplSession,
  SmsIdentity,
  SmsIdentityUsage,
  SmsMessage,
  SmsQuota,
} from "../../src/features/db/db.types";
import type { ExecutionResult, ReplLanguage } from "../../src/features/repl/repl.types";

/**
 * Mutable test database plus row collections for assertions.
 * @description Exposes persisted rows so integration tests can verify lifecycle
 * behavior without coupling production code to storage internals.
 */
export interface InMemoryDb extends Db {
  /** Persisted SMS identities. */
  identities: SmsIdentity[];
  /** Persisted SMS provider messages. */
  messages: SmsMessage[];
  /** Persisted execution jobs. */
  jobs: ExecutionJob[];
  /** Persisted output rows keyed by job id. */
  outputs: Array<{ executionJobId: string; result: ExecutionResult }>;
}

/**
 * Creates an in-memory database that follows the production `Db` contract.
 * @returns Test database with deterministic ids and mutable row collections.
 * @remarks Integration tests care about feature behavior, not Drizzle itself, so
 * this fake keeps webhook and job lifecycle tests local and fast.
 */
export function createInMemoryDb(): InMemoryDb {
  let identitySequence = 0;
  let messageSequence = 0;
  let jobSequence = 0;
  const identities: SmsIdentity[] = [];
  const messages: SmsMessage[] = [];
  const jobs: ExecutionJob[] = [];
  const sessions: ReplSession[] = [];
  const quotas: SmsQuota[] = [];
  const outputs: Array<{ executionJobId: string; result: ExecutionResult }> = [];

  return {
    identities,
    messages,
    jobs,
    outputs,

    async findOrCreateSmsIdentity(phoneE164) {
      const existing = identities.find((identity) => identity.phoneE164 === phoneE164);

      if (existing) {
        return existing;
      }

      const now = new Date();
      const identity: SmsIdentity = {
        id: `smsid_${++identitySequence}`,
        userId: null,
        phoneE164,
        defaultLanguage: "python",
        isVerified: false,
        createdAt: now,
        updatedAt: now,
      };
      identities.push(identity);
      return identity;
    },

    async verifySmsIdentity(phoneE164) {
      const identity = await this.findOrCreateSmsIdentity(phoneE164);
      identity.isVerified = true;
      identity.updatedAt = new Date();
      return identity;
    },

    async findSmsMessageByProviderSid(providerMessageSid) {
      return messages.find((message) => message.providerMessageSid === providerMessageSid) ?? null;
    },

    async insertInboundSms(input) {
      return insertMessage(input);
    },

    async insertOutboundSms(input) {
      return insertMessage(input);
    },

    async updateSmsStatus(input) {
      const message = messages.find(
        (candidate) => candidate.providerMessageSid === input.providerMessageSid,
      );

      if (!message) {
        throw new Error(`SMS message ${input.providerMessageSid} does not exist`);
      }

      message.status = input.status;
      message.rawPayload = input.rawPayload;
    },

    async createExecutionJob(input) {
      const now = new Date();
      const job: ExecutionJob = {
        id: `job_${++jobSequence}`,
        smsMessageId: input.smsMessageId,
        smsIdentityId: input.smsIdentityId,
        language: input.language,
        code: input.code,
        status: "queued",
        timeoutMs: input.timeoutMs,
        maxOutputChars: input.maxOutputChars,
        sandboxId: null,
        exitCode: null,
        durationMs: null,
        errorCode: null,
        createdAt: now,
        startedAt: null,
        finishedAt: null,
      };
      jobs.push(job);
      return job;
    },

    async markExecutionRunning(id, sandboxId) {
      const job = requireJob(id);

      if (job.status !== "queued") {
        throw new Error(`Execution job ${id} is not queued or does not exist`);
      }

      job.status = "running";
      job.sandboxId = sandboxId ?? null;
      job.startedAt = new Date();
    },

    async finishExecutionJob(id, result) {
      const job = requireJob(id);
      job.status = result.status;
      job.sandboxId = result.sandboxId ?? null;
      job.exitCode = result.exitCode;
      job.durationMs = result.durationMs;
      job.errorCode = result.errorCode ?? null;
      job.finishedAt = new Date();
      outputs.push({ executionJobId: id, result });
    },

    async getActiveSession(identityId) {
      return (
        sessions.find(
          (session) => session.smsIdentityId === identityId && session.status === "active",
        ) ?? null
      );
    },

    async upsertSessionLanguage(identityId, language) {
      upsertSession(identityId, language);
    },

    async recordSessionExecution(identityId, language, jobId) {
      upsertSession(identityId, language, jobId);
    },

    async resetActiveSession(identityId) {
      for (const session of sessions) {
        if (session.smsIdentityId === identityId && session.status === "active") {
          session.status = "reset";
          session.state = {};
          session.lastActiveAt = new Date();
        }
      }
    },

    async countExecutionsForPhone(phoneE164, since) {
      const identityIds = identities
        .filter((identity) => identity.phoneE164 === phoneE164)
        .map((identity) => identity.id);

      return jobs.filter(
        (job) =>
          job.smsIdentityId && identityIds.includes(job.smsIdentityId) && job.createdAt >= since,
      ).length;
    },

    async getSmsQuota(phoneE164) {
      return quotas.find((quota) => quota.phoneE164 === phoneE164) ?? null;
    },

    async upsertSmsQuota(input) {
      const existing = quotas.find((quota) => quota.phoneE164 === input.phoneE164);
      const quota: SmsQuota = {
        phoneE164: input.phoneE164,
        hourlyLimit: input.hourlyLimit ?? existing?.hourlyLimit ?? 20,
        dailyLimit: input.dailyLimit ?? existing?.dailyLimit ?? 100,
        disabled: input.disabled ?? existing?.disabled ?? false,
        reason: input.reason ?? existing?.reason ?? null,
        updatedAt: new Date(),
      };

      if (existing) {
        Object.assign(existing, quota);
        return existing;
      }

      quotas.push(quota);
      return quota;
    },

    async listRecentSmsMessages(limit) {
      return [...messages].sort(descCreatedAt).slice(0, limit);
    },

    async listRecentExecutionJobs(limit, status) {
      return [...jobs]
        .filter((job) => (status ? job.status === status : true))
        .sort(descCreatedAt)
        .slice(0, limit);
    },

    async listSmsIdentityUsage(limit) {
      return identities.slice(0, limit).map(
        (identity): SmsIdentityUsage => ({
          id: identity.id,
          phoneE164: identity.phoneE164,
          defaultLanguage: identity.defaultLanguage,
          executionCount: jobs.filter((job) => job.smsIdentityId === identity.id).length,
          hourlyLimit: 20,
          dailyLimit: 100,
          disabled: false,
          quotaReason: null,
          lastActiveAt: null,
        }),
      );
    },
  };

  /**
   * Inserts an SMS message with provider SID idempotency.
   * @param input - Normalized SMS event from the feature boundary.
   * @returns Stored SMS message row.
   */
  function insertMessage(input: InsertSmsMessage): SmsMessage {
    if (input.providerMessageSid) {
      const existing = messages.find(
        (message) => message.providerMessageSid === input.providerMessageSid,
      );

      if (existing) {
        return existing;
      }
    }

    const message: SmsMessage = {
      id: `sms_${++messageSequence}`,
      direction: input.direction,
      provider: "sms8",
      providerMessageSid: input.providerMessageSid,
      phoneE164: input.phoneE164,
      body: input.body,
      status: input.status,
      rawPayload: input.rawPayload,
      createdAt: new Date(),
    };
    messages.push(message);
    return message;
  }

  /**
   * Reads a job or fails with the same shape as the production DB boundary.
   * @param id - Execution job identifier.
   * @returns Mutable execution job row.
   */
  function requireJob(id: string): ExecutionJob {
    const job = jobs.find((candidate) => candidate.id === id);

    if (!job) {
      throw new Error(`Execution job ${id} does not exist`);
    }

    return job;
  }

  /**
   * Creates or updates the active session for a phone identity.
   * @param identityId - SMS identity that owns the active session.
   * @param language - Runtime selected by parser or language command.
   * @param jobId - Optional most recent execution job id.
   * @returns Active session row after mutation.
   */
  function upsertSession(identityId: string, language: ReplLanguage, jobId?: string): ReplSession {
    const now = new Date();
    const existing = sessions.find(
      (session) => session.smsIdentityId === identityId && session.status === "active",
    );

    if (existing) {
      existing.language = language;
      existing.state = { defaultLanguage: language, lastExecutionJobId: jobId };
      existing.lastActiveAt = now;
      return existing;
    }

    const session: ReplSession = {
      id: `sess_${sessions.length + 1}`,
      smsIdentityId: identityId,
      language,
      status: "active",
      state: { defaultLanguage: language, lastExecutionJobId: jobId },
      lastActiveAt: now,
      createdAt: now,
    };
    sessions.push(session);
    return session;
  }
}

/**
 * Sorts rows newest first for admin-list contract methods.
 * @param left - Row with a creation timestamp.
 * @param right - Row with a creation timestamp.
 * @returns Sort comparator result for descending creation time.
 */
function descCreatedAt(left: { createdAt: Date }, right: { createdAt: Date }): number {
  return right.createdAt.getTime() - left.createdAt.getTime();
}
