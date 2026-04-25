/**
 * @file current-user.ts
 * @description Current-user lookup boundary for web and admin features.
 * @module auth
 */
import { getAuthConfig, type Env } from "../../shared/env";
import { createAuth } from "./auth";
import type { AuthUser } from "./auth.types";

/**
 * Returns the current authenticated web user, if one exists.
 * @param request - Incoming request carrying Better Auth session cookies.
 * @param env - Worker bindings for auth secrets and database access.
 * @returns Authenticated user with allowlist-derived admin status, or null.
 * @remarks SMS identity lookup intentionally does not happen here; phone-only
 * users must remain independent from web sessions until explicit linking lands.
 */
export async function getOptionalUser(request: Request, env: Env): Promise<AuthUser | null> {
  const config = getAuthConfig(env);
  const session = await createAuth(env).api.getSession({
    headers: request.headers,
    query: {
      disableRefresh: request.method === "GET",
    },
  });

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isAdmin: isAdminEmail(session.user.email, config.adminEmails),
  };
}

/**
 * Legacy current-user alias for older feature imports.
 * @param request - Incoming request carrying Better Auth session cookies.
 * @param env - Worker bindings for auth secrets and database access.
 * @returns Authenticated user with allowlist-derived admin status, or null.
 * @remarks This keeps Phase 0 callers compiling while new code uses the more
 * explicit `getOptionalUser` name from the implementation plan.
 */
export async function getCurrentUser(request: Request, env: Env): Promise<AuthUser | null> {
  return getOptionalUser(request, env);
}

/**
 * Checks whether a session email is in the temporary admin allowlist.
 * @param email - Better Auth user email from the current session.
 * @param adminEmails - Normalized allowlist from Worker configuration.
 * @returns Whether the user should receive MVP admin access.
 * @remarks The allowlist is deliberately exact-match so accidental public signup
 * cannot grant admin access before roles are moved into the database.
 */
function isAdminEmail(email: string | null | undefined, adminEmails: ReadonlySet<string>): boolean {
  return Boolean(email && adminEmails.has(email.toLowerCase()));
}
