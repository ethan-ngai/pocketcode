/**
 * @file python.ts
 * @description Python runtime adapter for sandbox execution.
 * @module repl
 */
import type { ExecutionRequest, SandboxCommandResult, SandboxRuntime } from "../repl.types";

/**
 * Python language identifier.
 * @remarks Exporting the literal keeps future runtime adapter registration tied
 * to the shared `ReplLanguage` contract.
 */
export const pythonLanguage = "python";

/**
 * Executes a Python one-shot job in an isolated sandbox workspace.
 * @param sandbox - Cloudflare Sandbox runtime scoped to the execution job.
 * @param request - Normalized execution request with code and timeout policy.
 * @param workspaceDir - Absolute directory reserved for this job.
 * @returns Captured command result normalized for the REPL job layer.
 * @remarks User code is written to a file and executed through a fixed command,
 * avoiding shell interpolation of untrusted source text.
 */
export async function runPythonCommand(
  sandbox: SandboxRuntime,
  request: ExecutionRequest,
  workspaceDir: string,
): Promise<SandboxCommandResult> {
  await sandbox.writeFile(`${workspaceDir}/main.py`, request.code);

  try {
    const result = await sandbox.exec("python3 main.py", {
      cwd: workspaceDir,
      timeout: request.timeoutMs,
      env: {},
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      timedOut: false,
    };
  } catch (error) {
    return commandErrorToResult(error, request.timeoutMs);
  }
}

/**
 * Converts SDK command failures into a stable result shape.
 * @param error - Unknown SDK exception thrown by `exec`.
 * @param timeoutMs - Timeout budget used for the failed command.
 * @returns Timed-out or failed command result.
 */
function commandErrorToResult(error: unknown, timeoutMs: number): SandboxCommandResult {
  const message = error instanceof Error ? error.message : String(error);
  const timedOut =
    message.toLowerCase().includes("timeout") || message.toLowerCase().includes("timed out");

  return {
    stdout: "",
    stderr: timedOut ? `Timed out after ${Math.round(timeoutMs / 1_000)}s.` : "Execution failed.",
    exitCode: null,
    timedOut,
  };
}
