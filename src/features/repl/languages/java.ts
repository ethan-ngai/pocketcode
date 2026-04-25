/**
 * @file java.ts
 * @description Java runtime adapter for sandbox execution.
 * @module repl
 */
import type { ExecutionRequest, SandboxCommandResult, SandboxRuntime } from "../repl.types";

/**
 * Java language identifier.
 * @remarks Exporting the literal keeps future runtime adapter registration tied
 * to the shared `ReplLanguage` contract.
 */
export const javaLanguage = "java";

/**
 * Executes a Java one-shot job in an isolated sandbox workspace.
 * @param sandbox - Cloudflare Sandbox runtime scoped to the execution job.
 * @param request - Normalized execution request with code and timeout policy.
 * @param workspaceDir - Absolute directory reserved for this job.
 * @returns Captured command result normalized for the REPL job layer.
 * @remarks Snippets are wrapped in `public class Main` while full-class
 * submissions are preserved, matching the SMS UX plan without persistent state.
 */
export async function runJavaCommand(
  sandbox: SandboxRuntime,
  request: ExecutionRequest,
  workspaceDir: string,
): Promise<SandboxCommandResult> {
  await sandbox.writeFile(`${workspaceDir}/Main.java`, toJavaProgram(request.code));

  try {
    const result = await sandbox.exec("ecj Main.java && java Main", {
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
 * Converts SMS Java snippets into a compilable class.
 * @param code - User-submitted Java snippet or full `Main` class.
 * @returns Complete Java source for `Main.java`.
 * @remarks Full-class mode lets advanced users control imports and helper
 * methods, while snippet mode keeps the SMS path concise.
 */
export function toJavaProgram(code: string): string {
  if (/\bpublic\s+class\s+Main\b/.test(code)) {
    return code;
  }

  return `public class Main {
  public static void main(String[] args) throws Exception {
${indentSnippet(code)}
  }
}
`;
}

/**
 * Indents snippet code inside the generated main method.
 * @param code - User-submitted Java snippet.
 * @returns Indented snippet preserving user line breaks.
 */
function indentSnippet(code: string): string {
  return code
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
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
