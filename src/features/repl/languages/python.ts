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
 * @param _workspaceDir - Reserved job directory kept for adapter parity.
 * @returns Captured command result normalized for the REPL job layer.
 * @remarks Uses the Sandbox SDK's native interpreter instead of shelling out to
 * `python3`, which avoids managing transient source files for simple SMS jobs.
 */
export async function runPythonCommand(
  sandbox: SandboxRuntime,
  request: ExecutionRequest,
  _workspaceDir: string,
): Promise<SandboxCommandResult> {
  try {
    const result = await sandbox.runCode(request.code, {
      language: "python",
      timeout: request.timeoutMs,
      envVars: {},
    });
    const resultText = result.results
      .map((entry) => entry.text)
      .filter((text): text is string => Boolean(text))
      .join("\n");
    const stdout = [result.logs.stdout.join(""), resultText].filter(Boolean).join("\n");
    const stderr = [
      result.logs.stderr.join(""),
      result.error ? formatExecutionError(result.error) : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      stdout,
      stderr,
      exitCode: result.error ? 1 : 0,
      timedOut: false,
    };
  } catch (error) {
    return commandErrorToResult(error, request.timeoutMs);
  }
}

/**
 * Formats interpreter errors into terminal-style stderr.
 * @param error - Structured interpreter error from the Sandbox SDK.
 * @returns Traceback text when available, otherwise a concise error line.
 */
function formatExecutionError(error: {
  name: string;
  message: string;
  traceback: string[];
  lineNumber?: number;
}): string {
  return error.traceback.length > 0 ? error.traceback.join("\n") : `${error.name}: ${error.message}`;
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
