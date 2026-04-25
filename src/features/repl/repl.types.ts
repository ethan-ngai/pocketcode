/**
 * @file repl.types.ts
 * @description Stable REPL execution contracts shared by SMS, admin, and sandbox code.
 * @module repl
 */

/**
 * Language identifiers accepted by user-facing SMS commands and persisted jobs.
 * @remarks Keeping this as a small literal union avoids drift between parser,
 * database checks, and sandbox dispatch.
 */
export type ReplLanguage = "python" | "java";

/**
 * Parsed SMS command contract used before persistence or sandbox execution.
 * @remarks The parser returns explicit non-execution commands so the SMS
 * workflow can respond without creating misleading execution jobs.
 */
export type SmsCommand =
  | { kind: "execute"; language: ReplLanguage; code: string }
  | { kind: "set_language"; language: ReplLanguage }
  | { kind: "reset" }
  | { kind: "help" }
  | { kind: "unknown"; reason: string };

/**
 * Durable lifecycle states for execution jobs.
 * @remarks These values intentionally match the planned database check
 * constraint, so status changes can move across modules without translation.
 */
export type ExecutionStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out"
  | "rejected";

/**
 * Normalized execution request sent from job orchestration to a sandbox runner.
 * @remarks Phone and user identifiers stay on the request to support audit logs
 * and anonymous SMS users without forcing Better Auth linkage up front.
 */
export interface ExecutionRequest {
  /** Stable job identifier allocated before sandbox execution starts. */
  id: string;
  /** Better Auth user id when the phone identity has been linked. */
  userId: string | null;
  /** E.164 phone number that owns the SMS execution context. */
  phoneE164: string;
  /** Runtime selected by prefix or the sender's default language. */
  language: ReplLanguage;
  /** Source text after command prefix stripping and size validation. */
  code: string;
  /** Per-job timeout budget so callers can persist the exact policy used. */
  timeoutMs: number;
  /** Persisted output budget used for SMS previews and admin inspection. */
  maxOutputChars: number;
}

/**
 * Normalized sandbox result persisted with an execution job.
 * @remarks The result separates stdout and stderr because SMS may preview a
 * combined value while admin screens still need lossless streams.
 */
export interface ExecutionResult {
  /** Terminal or in-progress status reported by the execution pipeline. */
  status: ExecutionStatus;
  /** Captured standard output, stored in full even when SMS is truncated. */
  stdout: string;
  /** Captured standard error, sanitized before SMS egress where needed. */
  stderr: string;
  /** Process exit code when the sandbox runtime exposes one. */
  exitCode: number | null;
  /** Measured runtime duration for auditing and abuse controls. */
  durationMs: number;
  /** Sandbox instance id for provider-level debugging. */
  sandboxId?: string;
  /** Stable machine-readable failure reason for retry and admin UX. */
  errorCode?: string;
}

/**
 * Minimal command result returned by language-specific sandbox adapters.
 * @remarks The Cloudflare SDK exposes more metadata, but the REPL feature only
 * needs process output and exit state to maintain its stable public contract.
 */
export interface SandboxCommandResult {
  /** Captured standard output. */
  stdout: string;
  /** Captured standard error. */
  stderr: string;
  /** Process exit code reported by the sandbox command runner. */
  exitCode: number | null;
  /** Whether the command exceeded its timeout budget. */
  timedOut: boolean;
}

/**
 * Small subset of Sandbox SDK methods used by one-shot language adapters.
 * @remarks Keeping adapters on this interface makes them testable without
 * importing the full Durable Object-backed SDK in unit tests.
 */
export interface SandboxRuntime {
  /**
   * Creates a directory inside the sandbox filesystem.
   * @param path - Absolute path isolated for the current execution job.
   * @param options - Directory creation options supported by the SDK.
   * @returns Promise that resolves once the directory exists.
   */
  mkdir(path: string, options?: { recursive?: boolean }): Promise<unknown>;
  /**
   * Writes source text into the sandbox filesystem.
   * @param path - Absolute path where the file should be written.
   * @param content - Source code or wrapper text.
   * @returns Promise that resolves once the file is written.
   */
  writeFile(path: string, content: string): Promise<unknown>;
  /**
   * Executes a fixed command inside the sandbox.
   * @param command - Shell command controlled by the REPL adapter.
   * @param options - Working directory and timeout policy for one execution.
   * @returns Captured process output from the SDK.
   */
  exec(
    command: string,
    options?: { cwd?: string; timeout?: number; env?: Record<string, string | undefined> },
  ): Promise<{
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
  }>;
}
