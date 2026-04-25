/**
 * @file worker.ts
 * @description Cloudflare Worker entrypoint with Sandbox container export.
 * @module platform
 */
import startEntry from "@tanstack/react-start/server-entry";

export { Sandbox } from "@cloudflare/sandbox";

/**
 * Delegates normal HTTP traffic to TanStack Start.
 * @remarks The custom entrypoint exists so Wrangler can see the Sandbox Durable
 * Object class export while preserving TanStack Start's generated request path.
 */
export default {
  fetch: startEntry.fetch,
};
