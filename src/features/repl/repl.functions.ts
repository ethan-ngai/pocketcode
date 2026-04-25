/**
 * @file repl.functions.ts
 * @description Server-side REPL workflow entrypoints used by route wrappers.
 * @module repl
 */

/**
 * Placeholder manual execution handler for Phase 0 route wiring.
 * @returns A 501 JSON response until sandbox execution is implemented.
 * @remarks The route exists for admin/internal smoke tests, but executable code
 * must flow through the sandbox workstream before it can accept requests.
 */
export async function handleManualExecution(): Promise<Response> {
  return Response.json({ error: "REPL execution is not implemented yet." }, { status: 501 });
}
