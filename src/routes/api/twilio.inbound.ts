/**
 * @file twilio.inbound.ts
 * @description Thin Twilio inbound webhook route.
 * @module routes
 */
import { createFileRoute } from "@tanstack/react-router";
import { env, waitUntil } from "cloudflare:workers";
import { handleTwilioInbound } from "../../features/sms/sms.functions";
import type { Env } from "../../shared/env";

/**
 * Twilio inbound route definition.
 * @remarks Business logic lives in the SMS feature so provider parsing,
 * persistence, and execution orchestration do not accumulate in route files.
 */
export const Route = createFileRoute("/api/twilio/inbound")({
  server: {
    handlers: {
      POST: ({ request }) => handleTwilioInbound(request, env as Env, waitUntil),
    },
  },
});
