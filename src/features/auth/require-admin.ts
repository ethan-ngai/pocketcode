/**
 * @file require-admin.ts
 * @description Admin authorization boundary for route loaders and server functions.
 * @module auth
 */
import { AppError } from "../../shared/errors";
import type { Env } from "../../shared/env";
import type { AuthUser } from "./auth.types";
import { getOptionalUser } from "./current-user";

/**
 * Ensures the current request belongs to an allowed admin user.
 * @param request - Incoming request carrying Better Auth session cookies.
 * @param env - Worker bindings for auth and admin allowlist configuration.
 * @returns Authenticated admin user.
 * @remarks Centralizing this check keeps dashboards and internal execution APIs
 * aligned while the MVP uses `ADMIN_EMAILS` instead of persistent role rows.
 */
export async function requireAdmin(request: Request, env: Env): Promise<AuthUser> {
  const user = await getOptionalUser(request, env);

  if (!user) {
    throw new AppError("auth_required", "Authentication is required.", 401);
  }

  if (!user.isAdmin) {
    throw new AppError("admin_required", "Admin access is required.", 403);
  }

  return user;
}
