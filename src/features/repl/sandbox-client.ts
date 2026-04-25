/**
 * @file sandbox-client.ts
 * @description Cloudflare Sandbox client boundary for code execution.
 * @module repl
 */
import type { Env } from "../../shared/env";
import type { ExecutionRequest, ExecutionResult } from "./repl.types";

/**
 * Executes code in the configured sandbox runtime.
 * @param request - Persisted job data plus runtime policy for one-shot execution.
 * @param env - Worker bindings reserved for the sandbox workstream.
 * @returns A normalized failed result until the sandbox owner wires Cloudflare Sandbox.
 * @remarks The Twilio SMS workflow can safely call this boundary now; the sandbox
 * implementation can replace the body without changing SMS ingress code.
 */
export async function executeInSandbox(
  request: ExecutionRequest,
  env: Env,
): Promise<ExecutionResult> {
  void env;

  return {
    status: "failed",
    stdout: "",
    stderr: "Execution is not implemented yet.",
    exitCode: null,
    durationMs: 0,
    sandboxId: request.id,
    errorCode: "SANDBOX_NOT_IMPLEMENTED",
  };
}
