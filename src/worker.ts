/**
 * @file worker.ts
 * @description Optional Cloudflare Worker entrypoint reserved for platform exports.
 * @module platform
 */

/**
 * Worker readiness marker.
 * @remarks The default TanStack Start server entrypoint remains authoritative
 * until Sandbox, queues, or Durable Objects require custom Worker exports.
 */
export const workerEntrypointReady = false;
