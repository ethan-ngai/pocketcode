/**
 * @file auth.functions.ts
 * @description Better Auth route placeholders for the shared route contract.
 * @module auth
 */

/**
 * Placeholder Better Auth catch-all handler.
 * @returns A 501 response until Better Auth owns the route.
 * @remarks The catch-all route is created early so every workstream can rely on
 * `/api/auth/*` being reserved for authentication and not general API traffic.
 */
export async function handleAuthRequest(): Promise<Response> {
  return new Response("Auth handling is not implemented yet.", { status: 501 });
}
