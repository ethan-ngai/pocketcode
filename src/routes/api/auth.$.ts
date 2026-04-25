/**
 * @file auth.$.ts
 * @description Thin Better Auth catch-all route.
 * @module routes
 */
import { createFileRoute } from "@tanstack/react-router";
import { handleAuthRequest } from "../../features/auth/auth.functions";

/**
 * Better Auth catch-all route definition.
 * @remarks Reserving `/api/auth/*` prevents other API work from colliding with
 * the authentication provider's callback and session endpoints.
 */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: () => handleAuthRequest(),
      POST: () => handleAuthRequest(),
    },
  },
});
