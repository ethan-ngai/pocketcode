/**
 * @file sandbox-client.ts
 * @description Cloudflare Sandbox client boundary for code execution.
 * @module repl
 */

/**
 * Sandbox feature readiness marker.
 * @remarks Code execution must be added here rather than in route handlers so
 * the app Worker never grows ad-hoc shell or Docker execution paths.
 */
export const sandboxClientFeatureReady = false;
