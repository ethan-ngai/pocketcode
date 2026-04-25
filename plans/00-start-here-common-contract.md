# 00 — Start Here: Common Contract

This file must be implemented first. Every other workstream depends on these contracts to avoid merge conflicts.

## Goal

Create the minimal shared backbone for an SMS-based REPL that supports:

- inbound SMS commands through Twilio
- user/session resolution through phone numbers and Better Auth-linked accounts
- execution requests for Python and Java through Cloudflare Sandbox
- persistence in Neon Postgres
- one TanStack Start app deployed to Cloudflare Workers

## Non-negotiable architecture decisions

1. **Runtime**
   - App runtime: Cloudflare Workers.
   - Framework: TanStack Start.
   - Database: Neon Postgres.
   - DB access from Workers: prefer Cloudflare Hyperdrive + `postgres`/`pg`; fall back to `@neondatabase/serverless` only if Hyperdrive setup blocks local development.
   - Code execution: Cloudflare Sandbox SDK, not ad-hoc Docker or shell execution on the app Worker.
   - SMS provider: Twilio Programmable Messaging webhooks.
   - Auth: Better Auth for web/admin login. SMS identity is phone-number based and can later be linked to a Better Auth user.

2. **Core routing**
   - `/api/twilio/inbound` receives inbound SMS.
   - `/api/twilio/status` receives outbound status callbacks.
   - `/api/repl/execute` is internal/admin-only for manual testing.
   - `/api/auth/*` is owned by Better Auth.
   - `/app/*` or TanStack routes own the web UI.

3. **SMS execution model**
   - The first MVP should be **single-shot execution**, not a persistent interactive JVM/Python process.
   - A later phase may add persistent REPL sessions per phone number/language.
   - Every inbound SMS creates a `messages` row.
   - Every executable inbound SMS creates an `execution_jobs` row.
   - The Worker should return fast to Twilio, usually with empty TwiML or a short “Running…” message, then send the final output via Twilio REST API.

4. **Language commands**
   - `py <code>` executes Python.
   - `java <code>` executes Java.
   - `lang py` sets default language to Python.
   - `lang java` sets default language to Java.
   - `reset` clears active SMS REPL session state.
   - `help` returns command help.

5. **Output policy**
   - SMS output limit: split into chunks under 1,400 characters.
   - For longer output, send first chunk plus a truncation notice.
   - Store full output in DB.
   - Never send raw stack traces longer than one SMS chunk.
   - Execution timeout target: 5 seconds for MVP.
   - Max source size per SMS command: 2,000 characters after prefix stripping.

## Repository contract

Recommended layout:

```txt
/
  app/
    routes/
      index.tsx
      app/
      api/
        twilio.inbound.ts
        twilio.status.ts
        repl.execute.ts
        auth.$.ts
  src/
    auth/
      auth.ts
      better-auth-adapter.ts
    db/
      client.ts
      schema.ts
      migrations/
    sms/
      twilio.ts
      parser.ts
      responder.ts
      signatures.ts
    repl/
      contract.ts
      jobs.ts
      sandbox-client.ts
      languages/
        python.ts
        java.ts
    shared/
      env.ts
      errors.ts
      ids.ts
      logger.ts
  worker/
    server.ts
  wrangler.jsonc
  vite.config.ts
  package.json
```

## Shared TypeScript contracts

Create `src/repl/contract.ts` first:

```ts
export type ReplLanguage = "python" | "java";

export type SmsCommand =
  | { kind: "execute"; language: ReplLanguage; code: string }
  | { kind: "set_language"; language: ReplLanguage }
  | { kind: "reset" }
  | { kind: "help" }
  | { kind: "unknown"; reason: string };

export type ExecutionStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out"
  | "rejected";

export interface ExecutionRequest {
  id: string;
  userId: string | null;
  phoneE164: string;
  language: ReplLanguage;
  code: string;
  timeoutMs: number;
  maxOutputChars: number;
}

export interface ExecutionResult {
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  sandboxId?: string;
  errorCode?: string;
}
```

## Shared environment contract

Create `src/shared/env.ts` with typed access to:

```txt
DATABASE_URL or HYPERDRIVE binding
BETTER_AUTH_SECRET
BETTER_AUTH_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER
TWILIO_WEBHOOK_AUTH_ENABLED
APP_BASE_URL
EXECUTION_TIMEOUT_MS
EXECUTION_MAX_OUTPUT_CHARS
```

For Cloudflare bindings, define an `Env` interface and pass it through request handlers instead of importing global process state.

## Minimal database contract

The DB workstream owns full migrations, but the starting plan should agree on these table names:

- `users`
- `sms_identities`
- `sms_messages`
- `execution_jobs`
- `execution_outputs`
- `repl_sessions`
- `audit_events`

Do not rename these without updating all workstreams.

## Merge-conflict rules

- Only the starting-plan owner creates `src/repl/contract.ts`, `src/shared/env.ts`, and the route filenames.
- Each later workstream works inside its own directory:
  - DB: `src/db/**`
  - SMS: `src/sms/**` and Twilio route bodies
  - Sandbox: `src/repl/sandbox-client.ts`, `src/repl/languages/**`
  - Auth: `src/auth/**` and auth route
  - UI: `app/routes/app/**`
  - Observability/security: `src/shared/logger.ts`, `src/sms/signatures.ts`, tests
- Any cross-cutting changes must be proposed by adding a comment/TODO to this file first.

## MVP acceptance criteria

- `pnpm dev` runs locally.
- `wrangler deploy` deploys the app Worker.
- A POST to `/api/twilio/inbound` can parse `py print("hi")`.
- The app can create an `execution_jobs` row.
- The sandbox layer can run a smoke-test Python command and Java command.
- The Twilio responder can send an outbound SMS in a mocked local test.
- Better Auth route exists, even if only admin login is initially wired.
