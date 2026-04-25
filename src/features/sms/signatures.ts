/**
 * @file signatures.ts
 * @description Twilio signature validation boundary.
 * @module sms
 */

/**
 * Signature feature readiness marker.
 * @remarks Inbound routes must eventually call this boundary before trusting
 * provider payloads, but Phase 0 keeps validation unimplemented.
 */
export const twilioSignatureFeatureReady = false;
