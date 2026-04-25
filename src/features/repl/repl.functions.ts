/**
 * @file repl.functions.ts
 * @description Server-side REPL workflow entrypoints used by route wrappers.
 * @module repl
 */
import { createId } from "../../shared/ids";
import type { Env } from "../../shared/env";
import { AppError } from "../../shared/errors";
import { requireAdmin } from "../auth/require-admin";
import { SMS_MAX_SOURCE_CHARS } from "../sms/sms.types";
import {
  DEFAULT_EXECUTION_MAX_OUTPUT_CHARS,
  DEFAULT_EXECUTION_TIMEOUT_MS,
  DEFAULT_JAVA_EXECUTION_TIMEOUT_MS,
} from "../security/quotas";
import { executeInSandbox } from "./sandbox-client";
import type { ExecutionResult, ReplLanguage } from "./repl.types";

/**
 * Manual execution request accepted by the internal smoke-test route.
 * @remarks This route deliberately avoids session or SMS persistence; production
 * user executions should still enter through SMS job creation.
 */
interface ManualExecutionBody {
  /** Runtime selected for the one-shot command. */
  language?: unknown;
  /** Source code to execute. */
  code?: unknown;
  /** Optional timeout override in milliseconds. */
  timeoutMs?: unknown;
  /** Optional output cap override in characters. */
  maxOutputChars?: unknown;
}

/**
 * Handles internal manual execution smoke tests.
 * @param request - JSON request containing `language` and `code`.
 * @param env - Worker bindings containing the Sandbox Durable Object namespace.
 * @returns JSON execution result from the sandbox boundary.
 * @remarks This endpoint uses the admin gate but intentionally avoids job
 * persistence, making it useful for validating Sandbox deployment independently
 * from SMS ingress.
 */
export async function handleManualExecution(request: Request, env: Env): Promise<Response> {
  try {
    await requireAdmin(request, env);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    }

    throw error;
  }

  const body = (await request.json().catch(() => null)) as ManualExecutionBody | null;

  if (!body) {
    return Response.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const validation = validateManualExecutionBody(body);

  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const result = await executeInSandbox(
    {
      id: createId("job"),
      userId: null,
      phoneE164: "+10000000000",
      language: validation.language,
      code: validation.code,
      timeoutMs:
        parsePositiveInteger(body.timeoutMs) ??
        (validation.language === "java" ? DEFAULT_JAVA_EXECUTION_TIMEOUT_MS : DEFAULT_EXECUTION_TIMEOUT_MS),
      maxOutputChars: parsePositiveInteger(body.maxOutputChars) ?? DEFAULT_EXECUTION_MAX_OUTPUT_CHARS,
    },
    env,
  );

  return Response.json(toManualExecutionResponse(result));
}

/**
 * Validates manual execution JSON.
 * @param body - Unknown JSON object from the request.
 * @returns Parsed language and code or a user-facing validation error.
 */
function validateManualExecutionBody(
  body: ManualExecutionBody,
): { ok: true; language: ReplLanguage; code: string } | { ok: false; error: string } {
  if (body.language !== "python" && body.language !== "java") {
    return { ok: false, error: "language must be python or java." };
  }

  if (typeof body.code !== "string" || !body.code.trim()) {
    return { ok: false, error: "code is required." };
  }

  if (body.code.length > SMS_MAX_SOURCE_CHARS) {
    return { ok: false, error: `Code is too long. Limit: ${SMS_MAX_SOURCE_CHARS} characters.` };
  }

  return { ok: true, language: body.language, code: body.code };
}

/**
 * Parses optional positive integer controls from JSON.
 * @param value - Unknown JSON field.
 * @returns Positive integer when supplied, otherwise null.
 */
function parsePositiveInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Selects the stable JSON fields returned by the smoke-test route.
 * @param result - Normalized sandbox execution result.
 * @returns JSON-serializable execution response.
 */
function toManualExecutionResponse(result: ExecutionResult): Record<string, unknown> {
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    sandboxId: result.sandboxId,
    errorCode: result.errorCode,
  };
}
