/**
 * @file twilio.status.ts
 * @description Thin Twilio delivery-status webhook route.
 * @module routes
 */
import { createFileRoute } from "@tanstack/react-router";
import { handleTwilioStatus } from "../../features/sms/sms.functions";

/**
 * Twilio status route definition.
 * @remarks The route is reserved separately from inbound SMS because callback
 * payloads have different idempotency and persistence concerns.
 */
export const Route = createFileRoute("/api/twilio/status")({
  server: {
    handlers: {
      POST: () => handleTwilioStatus(),
    },
  },
});
