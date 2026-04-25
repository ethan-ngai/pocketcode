/**
 * @file jobs.ts
 * @description Execution job orchestration boundary for the REPL workstream.
 * @module repl
 */
import type { Db } from "../db/client";
import type { ExecutionJob, SmsIdentity } from "../db/db.types";
import type { Env } from "../../shared/env";
import { executeInSandbox } from "./sandbox-client";
import type { ExecutionResult } from "./repl.types";

/**
 * Data needed to run an execution job created by the SMS workflow.
 * @remarks The SMS feature owns ingress and response delivery, while this shape
 * keeps lifecycle transitions inside the REPL boundary.
 */
export interface RunExecutionJobInput {
  /** Persisted queued job row. */
  job: ExecutionJob;
  /** SMS identity that owns phone and optional user linkage context. */
  identity: SmsIdentity;
  /** Database boundary used for lifecycle persistence. */
  db: Db;
  /** Worker bindings required by the sandbox client. */
  env: Env;
}

/**
 * Runs a persisted execution job through the sandbox lifecycle.
 * @param input - Job, owner, persistence, and environment dependencies.
 * @returns Terminal execution result after persistence has been attempted.
 * @remarks Result SMS delivery happens in the SMS feature after this returns, so
 * REPL orchestration does not need SMS provider credentials or provider types.
 */
export async function runExecutionJob(input: RunExecutionJobInput): Promise<ExecutionResult> {
  await input.db.markExecutionRunning(input.job.id, input.job.id);

  const result = await executeInSandbox(
    {
      id: input.job.id,
      userId: input.identity.userId,
      phoneE164: input.identity.phoneE164,
      language: input.job.language,
      code: input.job.code,
      timeoutMs: input.job.timeoutMs,
      maxOutputChars: input.job.maxOutputChars,
    },
    input.env,
  );

  await input.db.finishExecutionJob(input.job.id, result);
  return result;
}
