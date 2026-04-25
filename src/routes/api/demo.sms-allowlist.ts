/**
 * @file demo.sms-allowlist.ts
 * @description Demo-only route for adding phone numbers to SMS pilot access.
 * @module routes
 */
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handleDemoSmsAllowlist } from "../../features/sms/sms.functions";
import type { Env } from "../../shared/env";

/**
 * Public demo allowlist route definition.
 * @remarks The demo page uses this endpoint to opt a phone identity into SMS
 * execution without mutating immutable Cloudflare Worker environment variables.
 */
export const Route = createFileRoute("/api/demo/sms-allowlist")({
  server: {
    handlers: {
      POST: ({ request }) => handleDemoSmsAllowlist(request, env as Env),
    },
  },
});
