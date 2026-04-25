/**
 * @file sms.functions.ts
 * @description Server-side SMS workflow entrypoints used by route wrappers.
 * @module sms
 */
import { createTwiMlResponse } from "./responder";

/**
 * Placeholder Twilio inbound handler for Phase 0 route wiring.
 * @returns A 501 response with TwiML content type.
 * @remarks The SMS workstream will replace this while preserving the route's
 * thin delegation boundary and fast webhook response expectation.
 */
export async function handleTwilioInbound(): Promise<Response> {
  return new Response(createTwiMlResponse("SMS handling is not implemented yet."), {
    status: 501,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

/**
 * Placeholder Twilio status callback handler for Phase 0 route wiring.
 * @returns A 501 response until outbound callback persistence exists.
 * @remarks Keeping status callbacks behind a feature function prevents provider
 * payload details from leaking into TanStack route files.
 */
export async function handleTwilioStatus(): Promise<Response> {
  return new Response("Twilio status handling is not implemented yet.", { status: 501 });
}
