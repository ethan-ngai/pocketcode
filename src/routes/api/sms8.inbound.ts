/**
 * @file sms8.inbound.ts
 * @description Thin SMS8 inbound webhook route.
 * @module routes
 */
import { createFileRoute } from "@tanstack/react-router";
import { env, waitUntil } from "cloudflare:workers";
import { handleSms8Inbound } from "../../features/sms/sms.functions";
import type { Env } from "../../shared/env";

/**
 * SMS8 inbound route definition.
 * @remarks Business logic lives in the SMS feature so provider parsing,
 * persistence, and execution orchestration do not accumulate in route files.
 */
export const Route = createFileRoute("/api/sms8/inbound")({
  server: {
    handlers: {
      POST: ({ request }) => handleSms8Inbound(request, env as Env, waitUntil),
    },
  },
});
