/**
 * @file admin-route.functions.ts
 * @description Server function guard for admin TanStack routes.
 * @module auth
 */
import { createServerFn } from "@tanstack/react-start";

import type { Env } from "../../shared/env";

/**
 * Server-side admin route guard for TanStack route loaders.
 * @returns Authenticated admin identity for loader consumers that need it.
 * @remarks Server-only imports stay inside the handler so route modules can
 * import this RPC stub without pulling database clients into the browser build.
 */
export const ensureAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const [{ env }, { getRequest }, { requireAdmin }] = await Promise.all([
    import("cloudflare:workers"),
    import("@tanstack/react-start/server"),
    import("./require-admin"),
  ]);

  return requireAdmin(getRequest(), env as Env);
});
