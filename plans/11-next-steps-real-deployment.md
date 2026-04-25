# 11 — Next Steps for Real Deployment

## Goal

Move the current MVP implementation from passing local checks to a deployable, production-safe Cloudflare Worker that can receive Twilio SMS, run one-shot Python/Java jobs, and expose an admin dashboard without widening access beyond the intended pilot.

## Code changes needed before deployment

### 1. Wire the SMS route to the real database

`handleTwilioInbound` and `handleTwilioStatus` currently require an injected `Db` through test dependencies or non-standard `env.DB`/`env.SMS_DB` values. The production routes pass only Cloudflare `env`, so real Twilio webhooks will fail unless the SMS feature builds a DB client from `HYPERDRIVE.connectionString` or `DATABASE_URL`.

Required changes:

- Add a production DB resolver that uses `createPostgresDb` or `createDbFromConfig`.
- Prefer `HYPERDRIVE.connectionString` when available.
- Keep test dependency injection intact.
- Add an integration test for the default route path with a real-looking `Env` object, not only injected DB dependencies.

### 2. Enforce admin auth inside admin server functions

Admin route loaders call `ensureAdminSession`, but the data server functions should also enforce authorization directly. Server functions are callable boundaries and should not rely only on route composition.

Required changes:

- In `src/features/admin/admin.functions.ts`, call `requireAdmin(getRequest(), env as Env)` at the start of each admin data function.
- Keep phone numbers masked by default.
- Add tests or route-level coverage proving unauthenticated admin data requests are rejected.

### 3. Decide and implement phone access policy

The recommended MVP default is invite-only by allowlisted phone numbers, but current SMS ingress accepts any E.164 sender and only rate-limits execution.

Required changes if using invite-only:

- Add an allowlist source, likely an `SMS_ALLOWLIST` env binding for MVP or a DB-backed quota/access table.
- Check the allowlist after identity resolution and before command execution.
- Return a short refusal SMS without creating an execution job for non-allowlisted numbers.
- Document how pilot phone numbers are added and removed.

Required changes if going public:

- Record the decision in `plans/10-open-questions-and-decisions.md`.
- Set conservative daily Twilio caps and app quotas before exposing the webhook.
- Add monitoring for quota-limited and failed delivery counts.

### 4. Verify sandbox network isolation

The plan calls for no network access from user code. The current implementation avoids passing app secrets into the sandbox and filters obvious abuse patterns, but it does not prove or configure network blocking.

Required changes:

- Check the current Cloudflare Sandbox SDK support for disabling network access.
- Configure network-disabled execution if supported.
- Add an opt-in sandbox smoke test that attempts a network request and expects failure.
- If network cannot be disabled, document that as a launch risk and keep the pilot invite-only.

### 5. Make timeout copy match actual language timeout

The responder always says `Timed out after 5s.`, while Java jobs may use an 8 second timeout. This is acceptable for a rough MVP but confusing for real users.

Required changes:

- Include timeout metadata in the formatted execution result, or store a user-facing timeout message when creating the result.
- Update tests for Python and Java timeout messaging.

## Deployment setup tasks

### Cloudflare

- Confirm `wrangler.jsonc` matches the generated deploy config after `pnpm build`.
- Create or connect the Worker project.
- Configure the Sandbox container image build and Durable Object migration.
- Add Hyperdrive binding for Neon Postgres.
- Add production secrets:
  - `BETTER_AUTH_SECRET`
  - `DATABASE_URL` only if Hyperdrive is not ready
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`
  - `ADMIN_EMAILS`
  - `APP_BASE_URL`
- Set non-secret vars:
  - `BETTER_AUTH_URL`
  - `TWILIO_WEBHOOK_AUTH_ENABLED=true`
  - `EXECUTION_TIMEOUT_MS=5000`
  - `EXECUTION_MAX_OUTPUT_CHARS=4000`
  - `ENVIRONMENT=production`

### Database

- Provision Neon database.
- Apply Drizzle migrations to a fresh database.
- Verify Better Auth tables and app tables share the same user concept.
- Seed only required admin/test data.
- Confirm `findOrCreateSmsIdentity` and duplicate `MessageSid` behavior on the deployed database.

### Twilio

- Buy or configure the sender number or Messaging Service.
- Set inbound webhook URL to:

```txt
https://<production-host>/api/twilio/inbound
```

- Set status callback URL to:

```txt
https://<production-host>/api/twilio/status
```

- Enable a hard Twilio spend cap or alert before public testing.
- Send a real SMS smoke test from an allowlisted phone.

### Auth/admin

- Configure `ADMIN_EMAILS` for the project team.
- Verify Better Auth login in production.
- Verify unauthenticated users cannot load admin pages or admin server-function data.
- Confirm admin pages mask phone numbers by default.

## Pre-launch verification checklist

- `pnpm check` passes.
- `pnpm test` passes.
- `pnpm build` passes.
- `pnpm exec wrangler deploy --dry-run` passes.
- Migrations apply to a fresh database.
- Twilio signed webhook creates one inbound message row.
- Duplicate Twilio `MessageSid` does not create a second job.
- `help`, `lang py`, `lang java`, and `reset` do not create sandbox jobs.
- `py print("hi")` sends `Running code...` and then final output.
- Java snippet execution works.
- Infinite loops time out.
- Oversized source is rejected before sandbox execution.
- Disabled or non-allowlisted phone numbers do not create execution jobs.
- Sandbox code cannot read app secrets.
- Sandbox code cannot access the network, or the risk is explicitly accepted for an invite-only pilot.

## Launch recommendation

Launch as an invite-only limited pilot first. Keep Better Auth for admins only, use one-shot execution only, send immediate `Running code...` responses, mask phone numbers in admin UI, and enforce Twilio/app quotas before sharing the number outside the team.
