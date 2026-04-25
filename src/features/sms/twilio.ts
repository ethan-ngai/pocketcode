/**
 * @file twilio.ts
 * @description Twilio REST client boundary for outbound SMS.
 * @module sms
 */

/**
 * Twilio provider feature readiness marker.
 * @remarks Outbound delivery should be centralized here so execution code never
 * needs direct access to Twilio credentials.
 */
export const twilioProviderFeatureReady = false;
