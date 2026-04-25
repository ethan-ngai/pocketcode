/**
 * @file sandbox-client.ts
 * @description Cloudflare Sandbox client boundary for code execution.
 * @module repl
 */
import { getSandbox } from "@cloudflare/sandbox";

import type { Env } from "../../shared/env";
import { SMS_MAX_SOURCE_CHARS } from "../sms/sms.types";
import { runJavaCommand } from "./languages/java";
import { runPythonCommand } from "./languages/python";
import type {
  ExecutionRequest,
  ExecutionResult,
  SandboxCommandResult,
  SandboxRuntime,
} from "./repl.types";

/**
 * Executes code in the configured sandbox runtime.
 * @param request - Persisted job data plus runtime policy for one-shot execution.
 * @param env - Worker bindings reserved for the sandbox workstream.
 * @returns Normalized terminal result suitable for DB persistence and SMS egress.
 * @remarks The sandbox receives only source files and fixed commands, never app
 * credentials or Worker bindings that could be exfiltrated by user code.
 */
export async function executeInSandbox(
  request: ExecutionRequest,
  env: Env,
): Promise<ExecutionResult> {
  const started = Date.now();
  const rejection = validateExecutionRequest(request);

  if (rejection) {
    return {
      status: "rejected",
      stdout: "",
      stderr: rejection,
      exitCode: null,
      durationMs: Date.now() - started,
      sandboxId: request.id,
      errorCode: "EXECUTION_REJECTED",
    };
  }

  if (!env.Sandbox) {
    return {
      status: "failed",
      stdout: "",
      stderr: "Sandbox binding is not configured.",
      exitCode: null,
      durationMs: Date.now() - started,
      sandboxId: request.id,
      errorCode: "SANDBOX_BINDING_MISSING",
    };
  }

  const sandbox = getSandbox(env.Sandbox, request.id, { sleepAfter: "1m" }) as SandboxRuntime & {
    destroy?: () => Promise<void>;
  };
  const workspaceDir = `/workspace/jobs/${request.id}`;

  try {
    await sandbox.mkdir(workspaceDir, { recursive: true });

    const result = await runLanguageCommand(sandbox, request, workspaceDir);

    return {
      status: result.timedOut ? "timed_out" : result.exitCode === 0 ? "succeeded" : "failed",
      stdout: clampOutput(result.stdout, request.maxOutputChars),
      stderr: clampOutput(result.stderr, request.maxOutputChars),
      exitCode: result.exitCode,
      durationMs: Date.now() - started,
      sandboxId: request.id,
      errorCode: result.timedOut
        ? "EXECUTION_TIMEOUT"
        : result.exitCode === 0
          ? undefined
          : "PROCESS_EXIT_NONZERO",
    };
  } catch (error) {
    return {
      status: "failed",
      stdout: "",
      stderr: "Execution failed.",
      exitCode: null,
      durationMs: Date.now() - started,
      sandboxId: request.id,
      errorCode: error instanceof Error ? "SANDBOX_EXECUTION_ERROR" : "SANDBOX_UNKNOWN_ERROR",
    };
  } finally {
    await destroySandbox(sandbox);
  }
}

/**
 * Runs the language-specific adapter for a sandbox job.
 * @param sandbox - Cloudflare Sandbox runtime scoped to one job.
 * @param request - Normalized execution request.
 * @param workspaceDir - Absolute workspace path reserved for the job.
 * @returns Captured command result before final status mapping.
 */
async function runLanguageCommand(
  sandbox: SandboxRuntime,
  request: ExecutionRequest,
  workspaceDir: string,
): Promise<SandboxCommandResult> {
  switch (request.language) {
    case "python":
      return await runPythonCommand(sandbox, request, workspaceDir);
    case "java":
      return await runJavaCommand(sandbox, request, workspaceDir);
  }
}

/**
 * Rejects requests that should never reach the sandbox runtime.
 * @param request - Execution request created from SMS or manual test flows.
 * @returns User-visible rejection reason, or null when execution may proceed.
 * @remarks These checks are not the security boundary; they reduce obvious cost
 * and secret-exfiltration attempts before sandbox isolation takes over.
 */
function validateExecutionRequest(request: ExecutionRequest): string | null {
  if (request.code.length > SMS_MAX_SOURCE_CHARS) {
    return `Code is too long. Limit: ${SMS_MAX_SOURCE_CHARS} characters.`;
  }

  if (request.timeoutMs <= 0 || request.maxOutputChars <= 0) {
    return "Invalid execution policy.";
  }

  if (request.language === "python" && hasPythonRejectedPattern(request.code)) {
    return "Code rejected by safety policy.";
  }

  if (request.language === "java" && hasJavaRejectedPattern(request.code)) {
    return "Code rejected by safety policy.";
  }

  return null;
}

/**
 * Checks for low-effort Python abuse patterns.
 * @param code - Python source submitted by an SMS or manual user.
 * @returns True when the source should be rejected before sandbox dispatch.
 */
function hasPythonRejectedPattern(code: string): boolean {
  return /\bimport\s+(socket|subprocess|os)\b|from\s+(socket|subprocess|os)\s+import\b|open\(\s*["']\/|while\s+True\s*:/.test(
    code,
  );
}

/**
 * Checks for low-effort Java abuse patterns.
 * @param code - Java source submitted by an SMS or manual user.
 * @returns True when the source should be rejected before sandbox dispatch.
 */
function hasJavaRejectedPattern(code: string): boolean {
  return /Runtime\.getRuntime\(\)|ProcessBuilder|System\.getenv|Files\.walk\(\s*["']\//.test(code);
}

/**
 * Truncates and normalizes command output before DB persistence.
 * @param value - Raw stdout or stderr returned by the sandbox.
 * @param maxChars - Maximum persisted characters for the stream.
 * @returns Output capped to the requested budget.
 */
function clampOutput(value: string, maxChars: number): string {
  const normalized = value.split(String.fromCharCode(0)).join("");

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxChars - "\n...[truncated]".length, 0))}\n...[truncated]`;
}

/**
 * Destroys a one-shot sandbox without masking execution results.
 * @param sandbox - Job-scoped sandbox runtime.
 * @returns Promise that resolves after cleanup is attempted.
 */
async function destroySandbox(
  sandbox: SandboxRuntime & { destroy?: () => Promise<void> },
): Promise<void> {
  try {
    await sandbox.destroy?.();
  } catch {
    // Cleanup failures should not hide the user's terminal execution result.
  }
}
