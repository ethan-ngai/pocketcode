/**
 * @file require-admin.ts
 * @description Admin authorization boundary for route loaders and server functions.
 * @module auth
 */
import { AppError } from "../../shared/errors";
import type { CurrentUser } from "./auth.types";

/**
 * Ensures a user is allowed to access admin-only functionality.
 * @param user - Current user resolved from Better Auth.
 * @returns The same user when admin access is allowed.
 * @remarks Centralizing the check keeps internal execution endpoints and admin
 * pages aligned once roles are backed by persistent auth data.
 */
export function requireAdmin(user: CurrentUser | null): CurrentUser {
  if (!user?.isAdmin) {
    throw new AppError("admin_required", "Admin access is required.", 403);
  }

  return user;
}
