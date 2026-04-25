# 09 — Parallel Implementation Map

## Goal

Let multiple people build in parallel with minimal merge conflicts using `src/features/<feature>` ownership boundaries.

## Phase 0: Required first

Only one person should own this.

- `00-start-here-common-contract.md`
- Create base repo layout.
- Create route stubs.
- Create shared contracts:
  - `src/features/repl/repl.types.ts`
  - `src/features/sms/sms.types.ts`
  - `src/shared/env.ts`
  - `src/shared/ids.ts`
- Add empty module placeholders for all workstreams.
- Add baseline `pnpm check`.

No other implementation should start until Phase 0 is merged.

## Phase 1: Parallel tracks

### Track A — Runtime foundation

Owns:

```txt
vite.config.ts
wrangler.jsonc
src/worker.ts
package.json scripts
src/routes/** route stubs only
```

Avoid touching feature implementation folders except for placeholder files.

### Track B — Database

Owns:

```txt
src/features/db/**
```

Coordinates with auth owner on Better Auth table compatibility. Exports DB row/insert/select types from `src/features/db/db.types.ts`.

### Track C — SMS

Owns:

```txt
src/features/sms/**
src/routes/api/twilio.inbound.ts thin wrapper
src/routes/api/twilio.status.ts thin wrapper
```

Only imports DB and REPL through stable feature interfaces. Main public entrypoint: `src/features/sms/sms.functions.ts`.

### Track D — Sandbox / REPL

Owns:

```txt
src/features/repl/**
```

Public boundary:

```txt
src/features/repl/repl.functions.ts
src/features/repl/repl.types.ts
```

Does not touch Twilio route code except through exported job API.

### Track E — Auth/admin

Owns:

```txt
src/features/auth/**
src/features/admin/**
src/routes/api/auth.$.ts thin wrapper
src/routes/app/admin/** route wrappers
```

Does not alter SMS execution flow.

### Track F — Tests/observability/security

Owns:

```txt
src/features/observability/**
src/features/security/**
tests/**
*.test.ts
```

May add tests for other tracks but should avoid changing their production code without review.

## Server function rule

Every server function file must be named `*.functions.ts` and live inside a feature folder. Examples:

```txt
src/features/sms/sms.functions.ts
src/features/repl/repl.functions.ts
src/features/auth/auth.functions.ts
src/features/admin/admin.functions.ts
```

Route files should import these functions. Do not define TanStack `createServerFn` handlers directly inside route files except as a temporary stub in Phase 0.

## Phase 2: Integration

Integration order:

1. DB migrations applied locally.
2. SMS route stores inbound messages.
3. Sandbox smoke test passes.
4. SMS route creates execution job.
5. Job service executes sandbox command.
6. SMS responder sends final message.
7. Admin dashboard reads jobs/messages.
8. Security owner enables signature validation and quotas.

## Merge conflict avoidance

- Do not reformat the whole repo.
- Do not rename shared files after Phase 0.
- Do not inline other teams' modules into route handlers.
- Do not create generic `src/lib/**` folders. Put code in the owning feature or in `src/shared/**` only if it is genuinely feature-neutral.
