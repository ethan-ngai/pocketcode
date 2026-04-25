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

Use a feature-first structure. TanStack route files stay in `src/routes/**` because TanStack Router/Start expects file-based routes there, but route files must be thin and delegate to feature modules.

Recommended layout:

```txt
/
  src/
    routes/
      __root.tsx
      index.tsx
      app/
        route.tsx
        admin/
          index.tsx
          messages.tsx
          executions.tsx
          users.tsx
      api/
        twilio.inbound.ts
        twilio.status.ts
        repl.execute.ts
        auth.$.ts

    features/
      auth/
        auth.ts
        auth.functions.ts
        auth.types.ts
        require-admin.ts
        current-user.ts
        components/
          AdminGuard.tsx

      db/
        client.ts
        schema.ts
        migrations/
        seed.ts
        db.types.ts

      sms/
        sms.functions.ts
        sms.types.ts
        parser.ts
        responder.ts
        signatures.ts
        twilio.ts

      repl/
        repl.functions.ts
        repl.types.ts
        jobs.ts
        sandbox-client.ts
        languages/
          python.ts
          java.ts

      admin/
        admin.functions.ts
        admin.types.ts
        components/
          ExecutionsTable.tsx
          MessagesTable.tsx
          UsersTable.tsx

      observability/
        logger.ts
        logger.types.ts

      security/
        rate-limit.ts
        quotas.ts
        security.types.ts

    shared/
      env.ts
      errors.ts
      ids.ts
      result.ts
      validation.ts

    worker.ts

  tests/
    contract/
    integration/

  wrangler.jsonc
  vite.config.ts
  package.json
```

## File naming rules

- Server functions must live in feature folders and use `*.functions.ts`.
  - Examples: `src/features/sms/sms.functions.ts`, `src/features/repl/repl.functions.ts`, `src/features/admin/admin.functions.ts`.
- Shared feature types must use `*.types.ts`.
  - Examples: `src/features/repl/repl.types.ts`, `src/features/sms/sms.types.ts`.
- TanStack route files should import feature functions/components. They should not contain DB queries, Twilio business logic, sandbox orchestration, or auth policy logic.
- Keep cross-feature imports one-directional where possible:
  - `routes -> features -> shared`
  - feature-to-feature imports are allowed only through `*.types.ts` or public function exports.
- Avoid `src/lib` as a dumping ground. Use `src/shared` only for truly generic utilities.

## TanStack Start organization notes

TanStack Start examples commonly keep file-based routes under `src/routes`. For this app, use `src/routes` as the routing shell and `src/features/<feature>` as the implementation boundary. Server functions should be called from route loaders/actions/components, but defined in feature-level `*.functions.ts` files so each workstream can own a separate folder.

## Shared TypeScript contracts

Create `src/features/repl/repl.types.ts` first:

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

- Only the starting-plan owner creates `src/features/repl/repl.types.ts`, `src/shared/env.ts`, and the route filenames.
- Each later workstream works inside its own directory:
  - DB: `src/features/db/**`
  - SMS: `src/features/sms/**` and thin Twilio route wrappers in `src/routes/api/**`
  - Sandbox/REPL: `src/features/repl/**`
  - Auth: `src/features/auth/**` and thin auth route wrapper
  - Admin UI: `src/features/admin/**` plus route wrappers in `src/routes/app/admin/**`
  - Observability/security: `src/features/observability/**`, `src/features/security/**`, tests
- Any cross-cutting changes must be proposed by adding a comment/TODO to this file first.

## MVP acceptance criteria

- `pnpm dev` runs locally.
- `wrangler deploy` deploys the app Worker.
- A POST to `/api/twilio/inbound` can parse `py print("hi")`.
- The app can create an `execution_jobs` row.
- The sandbox layer can run a smoke-test Python command and Java command.
- The Twilio responder can send an outbound SMS in a mocked local test.
- Better Auth route exists, even if only admin login is initially wired.
