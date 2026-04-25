/**
 * @file current-user.ts
 * @description Current-user lookup boundary for web and admin features.
 * @module auth
 */
import type { CurrentUser } from "./auth.types";

/**
 * Returns the current authenticated user when auth is implemented.
 * @returns Null during Phase 0 because Better Auth setup is not wired yet.
 * @remarks Callers can depend on this function shape before the auth workstream
 * adds cookie/session parsing.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return null;
}
