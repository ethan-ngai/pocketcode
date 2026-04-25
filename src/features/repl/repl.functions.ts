/**
 * @file repl.functions.ts
 * @description Server-side REPL workflow entrypoints used by route wrappers.
 * @module repl
 */
import type { Env } from "../../shared/env";
import { AppError } from "../../shared/errors";
import { requireAdmin } from "../auth/require-admin";

/**
 * Placeholder manual execution handler for Phase 0 route wiring.
 * @param request - Incoming admin request carrying Better Auth session cookies.
 * @param env - Worker bindings used by the shared admin authorization helper.
 * @returns A 501 JSON response until sandbox execution is implemented.
 * @remarks The route exists for admin/internal smoke tests, but executable code
 * must first pass the same admin gate as dashboards before it can accept code.
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

  return Response.json({ error: "REPL execution is not implemented yet." }, { status: 501 });
}
