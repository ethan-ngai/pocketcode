/**
 * @file env.ts
 * @description Typed Cloudflare binding and configuration access for request handlers.
 * @module shared
 */

/**
 * Minimal Hyperdrive binding shape needed by the first data-access workstream.
 * @remarks This local shape avoids blocking Phase 0 on generated Wrangler types
 * while still documenting the production binding contract.
 */
export interface HyperdriveBinding {
  /** Postgres connection string supplied by Cloudflare Hyperdrive. */
  connectionString: string;
}

/**
 * Cloudflare Worker bindings expected by the application.
 * @remarks Request handlers should receive this object from the Worker runtime
 * instead of importing process-level globals that do not exist on Workers.
 */
export interface Env {
  /** Direct Neon connection string for local development or fallback access. */
  DATABASE_URL?: string;
  /** Preferred pooled database binding for deployed Workers. */
  HYPERDRIVE?: HyperdriveBinding;
  /** Secret used by Better Auth for signing and encryption. */
  BETTER_AUTH_SECRET: string;
  /** Public Better Auth base URL for callback and cookie configuration. */
  BETTER_AUTH_URL: string;
  /** Comma-separated web emails allowed to access admin-only surfaces. */
  ADMIN_EMAILS?: string;
  /** GitHub OAuth client id for project-team login when configured. */
  GITHUB_CLIENT_ID?: string;
  /** GitHub OAuth client secret, kept server-side for OAuth callbacks. */
  GITHUB_CLIENT_SECRET?: string;
  /** Twilio account identifier used by REST API and webhook validation. */
  TWILIO_ACCOUNT_SID: string;
  /** Twilio auth token, kept server-side for REST API and signatures. */
  TWILIO_AUTH_TOKEN: string;
  /** Preferred Twilio sender abstraction for outbound SMS. */
  TWILIO_MESSAGING_SERVICE_SID?: string;
  /** Concrete Twilio sender number used when no messaging service is configured. */
  TWILIO_FROM_NUMBER?: string;
  /** Enables Twilio request signature validation for ingress routes. */
  TWILIO_WEBHOOK_AUTH_ENABLED?: string;
  /** Deployment environment name used for local-only safety bypasses. */
  ENVIRONMENT?: string;
  /** Public app origin used for callbacks and admin links. */
  APP_BASE_URL: string;
  /** Default sandbox timeout for single-shot execution. */
  EXECUTION_TIMEOUT_MS?: string;
  /** Default maximum stored output returned by execution. */
  EXECUTION_MAX_OUTPUT_CHARS?: string;
}

/**
 * Runtime configuration normalized from Worker bindings.
 * @remarks Feature code consumes parsed numbers and booleans so route handlers
 * fail near the edge when deployment configuration is incomplete.
 */
export interface AppConfig {
  /** Direct database URL or Hyperdrive connection string. */
  databaseUrl: string;
  /** Whether the database URL came from Hyperdrive. */
  usesHyperdrive: boolean;
  /** Better Auth signing secret. */
  betterAuthSecret: string;
  /** Better Auth public base URL. */
  betterAuthUrl: string;
  /** Lowercased admin email allowlist used until role rows exist. */
  adminEmails: ReadonlySet<string>;
  /** GitHub OAuth client id when project-team login is enabled. */
  githubClientId: string | null;
  /** GitHub OAuth client secret when project-team login is enabled. */
  githubClientSecret: string | null;
  /** Twilio account SID. */
  twilioAccountSid: string;
  /** Twilio auth token. */
  twilioAuthToken: string;
  /** Twilio messaging service SID when configured. */
  twilioMessagingServiceSid: string | null;
  /** Twilio sender number when configured. */
  twilioFromNumber: string | null;
  /** Whether inbound webhook signature checks are enforced. */
  twilioWebhookAuthEnabled: boolean;
  /** Public application base URL. */
  appBaseUrl: string;
  /** Sandbox timeout in milliseconds. */
  executionTimeoutMs: number;
  /** Maximum output characters persisted and previewed. */
  executionMaxOutputChars: number;
}

/**
 * Runtime configuration needed only by Better Auth and admin identity checks.
 * @remarks Auth routes should not fail just because Twilio or sandbox bindings
 * are absent in a local web/admin development session.
 */
export interface AuthConfig {
  /** Direct database URL or Hyperdrive connection string. */
  databaseUrl: string;
  /** Whether the database URL came from Hyperdrive. */
  usesHyperdrive: boolean;
  /** Better Auth signing secret. */
  betterAuthSecret: string;
  /** Better Auth public base URL. */
  betterAuthUrl: string;
  /** Lowercased admin email allowlist used until role rows exist. */
  adminEmails: ReadonlySet<string>;
  /** GitHub OAuth client id when project-team login is enabled. */
  githubClientId: string | null;
  /** GitHub OAuth client secret when project-team login is enabled. */
  githubClientSecret: string | null;
  /** Public application base URL. */
  appBaseUrl: string;
}

const DEFAULT_EXECUTION_TIMEOUT_MS = 5_000;
const DEFAULT_EXECUTION_MAX_OUTPUT_CHARS = 4_000;

/**
 * Builds validated application config from Cloudflare bindings.
 * @param env - Worker bindings supplied to the current request or test harness.
 * @returns Parsed config with numeric and boolean defaults applied.
 * @remarks This function centralizes env validation because individual features
 * will be implemented in parallel and should not each invent fallback behavior.
 */
export function getAppConfig(env: Env): AppConfig {
  const authConfig = getAuthConfig(env);
  const twilioMessagingServiceSid = emptyToNull(env.TWILIO_MESSAGING_SERVICE_SID);
  const twilioFromNumber = emptyToNull(env.TWILIO_FROM_NUMBER);

  if (!twilioMessagingServiceSid && !twilioFromNumber) {
    throw new Error("TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER is required");
  }

  return {
    ...authConfig,
    twilioAccountSid: requireBinding(env.TWILIO_ACCOUNT_SID, "TWILIO_ACCOUNT_SID"),
    twilioAuthToken: requireBinding(env.TWILIO_AUTH_TOKEN, "TWILIO_AUTH_TOKEN"),
    twilioMessagingServiceSid,
    twilioFromNumber,
    twilioWebhookAuthEnabled: parseBoolean(env.TWILIO_WEBHOOK_AUTH_ENABLED, true),
    appBaseUrl: requireBinding(env.APP_BASE_URL, "APP_BASE_URL"),
    executionTimeoutMs: parsePositiveInteger(
      env.EXECUTION_TIMEOUT_MS,
      DEFAULT_EXECUTION_TIMEOUT_MS,
      "EXECUTION_TIMEOUT_MS",
    ),
    executionMaxOutputChars: parsePositiveInteger(
      env.EXECUTION_MAX_OUTPUT_CHARS,
      DEFAULT_EXECUTION_MAX_OUTPUT_CHARS,
      "EXECUTION_MAX_OUTPUT_CHARS",
    ),
  };
}

/**
 * Builds validated auth config from Cloudflare bindings.
 * @param env - Worker bindings supplied to the current request or test harness.
 * @returns Parsed config needed by Better Auth and admin identity helpers.
 * @remarks This narrower parser lets auth endpoints run in environments where
 * SMS provider secrets are intentionally unavailable.
 */
export function getAuthConfig(env: Env): AuthConfig {
  const databaseUrl = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL or HYPERDRIVE binding is required");
  }

  return {
    databaseUrl,
    usesHyperdrive: Boolean(env.HYPERDRIVE?.connectionString),
    betterAuthSecret: requireBinding(env.BETTER_AUTH_SECRET, "BETTER_AUTH_SECRET"),
    betterAuthUrl: requireBinding(env.BETTER_AUTH_URL, "BETTER_AUTH_URL"),
    adminEmails: parseEmailSet(env.ADMIN_EMAILS),
    githubClientId: emptyToNull(env.GITHUB_CLIENT_ID),
    githubClientSecret: emptyToNull(env.GITHUB_CLIENT_SECRET),
    appBaseUrl: requireBinding(env.APP_BASE_URL, "APP_BASE_URL"),
  };
}

/**
 * Requires a non-empty binding value.
 * @param value - Raw binding value from the Worker environment.
 * @param name - Binding name used in the thrown setup error.
 * @returns The trimmed binding value.
 * @remarks Startup failures are preferable to partially configured SMS or auth
 * behavior that would be hard to diagnose through webhook retries.
 */
function requireBinding(value: string | undefined, name: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}

/**
 * Parses an optional positive integer binding.
 * @param value - Raw binding value from the Worker environment.
 * @param fallback - Default used when no value is configured.
 * @param name - Binding name used in the thrown setup error.
 * @returns Parsed positive integer.
 * @remarks Numeric parsing lives here so execution and SMS modules agree on the
 * same timeout and output budgets.
 */
function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

/**
 * Parses common boolean environment spellings.
 * @param value - Raw binding value from the Worker environment.
 * @param fallback - Default used when no value is configured.
 * @returns Parsed boolean.
 * @remarks Webhook validation defaults on because production should fail closed
 * unless local development explicitly opts out.
 */
function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value?.trim()) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/**
 * Converts empty strings to null for optional sender configuration.
 * @param value - Optional binding value.
 * @returns Trimmed value or null when unset.
 * @remarks Null is easier for provider selection code to pattern-match than a
 * mix of undefined and blank strings.
 */
function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Parses the temporary admin allowlist.
 * @param value - Comma-separated email list from Worker secrets or dev vars.
 * @returns Normalized email set for constant-time membership checks.
 * @remarks Lowercasing at the config boundary keeps authorization helpers from
 * disagreeing on case handling before DB-backed roles replace the allowlist.
 */
function parseEmailSet(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
