/**
 * @file twilio.inbound.ts
 * @description Thin Twilio inbound webhook route.
 * @module routes
 */
import { createFileRoute } from "@tanstack/react-router";
import { handleTwilioInbound } from "../../features/sms/sms.functions";

/**
 * Twilio inbound route definition.
 * @remarks Business logic lives in the SMS feature so provider parsing,
 * persistence, and execution orchestration do not accumulate in route files.
 */
export const Route = createFileRoute("/api/twilio/inbound")({
  server: {
    handlers: {
      POST: () => handleTwilioInbound(),
    },
  },
});
