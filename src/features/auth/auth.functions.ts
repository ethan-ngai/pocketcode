/**
 * @file auth.functions.ts
 * @description Better Auth route handlers for the shared route contract.
 * @module auth
 */
import type { Env } from "../../shared/env";
import { createAuth } from "./auth";

/**
 * Delegates an auth API request to Better Auth.
 * @param request - Raw web request from the TanStack API route.
 * @param env - Worker bindings used to build request-scoped auth config.
 * @returns Better Auth HTTP response.
 * @remarks The catch-all route stays thin so callback, session, and credential
 * endpoint behavior remains owned by Better Auth rather than local route code.
 */
export async function handleAuthRequest(request: Request, env: Env): Promise<Response> {
  return createAuth(env).handler(request);
}
