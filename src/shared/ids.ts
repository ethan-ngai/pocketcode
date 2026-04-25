/**
 * @file ids.ts
 * @description Shared identifier helpers for database and job records.
 * @module shared
 */

/**
 * Known id prefixes for durable records.
 * @remarks Prefixes make logs and SMS callback correlation readable without
 * coupling downstream code to table-specific id generation details.
 */
export type IdPrefix = "usr" | "smsid" | "sms" | "job" | "out" | "sess" | "audit";

/**
 * Creates a stable prefixed identifier.
 * @param prefix - Short table or domain prefix used for debugging.
 * @returns Prefixed UUID suitable for durable storage.
 * @remarks Cloudflare Workers expose Web Crypto, so this helper avoids Node-only
 * id packages and remains portable across local and deployed runtimes.
 */
export function createId(prefix: IdPrefix): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
