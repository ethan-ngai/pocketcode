/**
 * @file auth.$.ts
 * @description Thin Better Auth catch-all route.
 * @module routes
 */
import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";

import { handleAuthRequest } from "../../features/auth/auth.functions";
import type { Env } from "../../shared/env";

/**
 * Better Auth catch-all route definition.
 * @remarks Reserving `/api/auth/*` prevents other API work from colliding with
 * the authentication provider's callback and session endpoints.
 */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: () => handleAuthRequest(getRequest(), env as Env),
      POST: () => handleAuthRequest(getRequest(), env as Env),
    },
  },
});
