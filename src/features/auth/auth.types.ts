/**
 * @file auth.types.ts
 * @description Shared auth contracts for Better Auth and admin checks.
 * @module auth
 */

/**
 * Minimal authenticated user shape shared across feature boundaries.
 * @remarks Better Auth may own more fields later, but admin and SMS linkage only
 * need this stable subset during parallel implementation.
 */
export interface AuthUser {
  /** Better Auth user id. */
  id: string;
  /** Email address used for web/admin login. */
  email: string | null;
  /** Display name when supplied by the auth provider. */
  name: string | null;
  /** Whether the user can access admin-only routes and APIs. */
  isAdmin: boolean;
}

/**
 * Backward-compatible alias for feature code created before Better Auth landed.
 * @remarks Keeping the old name avoids forcing unrelated workstreams to rename
 * their local contracts while `AuthUser` becomes the public auth identity name.
 */
export type CurrentUser = AuthUser;
