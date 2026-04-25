/**
 * @file auth.ts
 * @description Better Auth configuration for web and admin identities.
 * @module auth
 */
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getAuthConfig, type Env } from "../../shared/env";
import * as schema from "../db/schema";

/**
 * Creates Better Auth for the current Worker request.
 * @param env - Cloudflare bindings supplied by the route adapter.
 * @returns Better Auth instance configured for Postgres and TanStack Start.
 * @remarks Email/password is enough for internal admin bootstrap; GitHub OAuth
 * is enabled only when both Worker secrets are present.
 */
export function createAuth(env: Env) {
  return betterAuth(createAuthOptions(env));
}

/**
 * Auth instance bound to a single Worker request environment.
 * @remarks Cloudflare bindings are request-scoped, so callers should treat this
 * type as request-local instead of caching it globally.
 */
export type ShebangAuth = ReturnType<typeof createAuth>;

/**
 * Builds Better Auth options from normalized Worker configuration.
 * @param env - Cloudflare bindings supplied by the route adapter.
 * @returns Better Auth configuration object.
 * @remarks Keeping options in a function lets CLI and tests reuse the mapping
 * without accidentally sharing a Postgres client across isolates.
 */
function createAuthOptions(env: Env) {
  const config = getAuthConfig(env);
  const queryClient = postgres(config.databaseUrl, { max: 5, prepare: false });
  const db = drizzle(queryClient, { schema });
  const github =
    config.githubClientId && config.githubClientSecret
      ? {
          clientId: config.githubClientId,
          clientSecret: config.githubClientSecret,
        }
      : undefined;

  return {
    appName: "Shebang",
    basePath: "/api/auth",
    baseURL: config.betterAuthUrl,
    secret: config.betterAuthSecret,
    trustedOrigins: [config.appBaseUrl, config.betterAuthUrl],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        ...schema,
        user: schema.users,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: github ? { github } : {},
    plugins: [tanstackStartCookies()],
    user: {
      modelName: "users",
    },
  };
}
