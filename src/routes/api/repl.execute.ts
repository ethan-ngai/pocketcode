/**
 * @file repl.execute.ts
 * @description Thin internal manual execution route.
 * @module routes
 */
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handleManualExecution } from "../../features/repl/repl.functions";
import type { Env } from "../../shared/env";

/**
 * Manual execution route definition.
 * @remarks This endpoint is reserved for admin/internal smoke tests and must
 * delegate execution policy to the REPL feature.
 */
export const Route = createFileRoute("/api/repl/execute")({
  server: {
    handlers: {
      POST: ({ request }) => handleManualExecution(request, env as Env),
    },
  },
});
