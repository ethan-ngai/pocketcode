# 09 — Parallel Implementation Map

## Goal

Let multiple people build in parallel with minimal merge conflicts.

## Phase 0: Required first

Only one person should own this.

- `00-start-here-common-contract.md`
- Create base repo layout.
- Create route stubs.
- Create shared contracts:
  - `src/repl/contract.ts`
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
worker/server.ts
package.json scripts
```

Avoid touching:

```txt
src/db/**
src/sms/**
src/repl/**
src/auth/**
```

### Track B — Database

Owns:

```txt
src/db/**
```

Coordinates with auth owner on Better Auth table compatibility.

### Track C — SMS

Owns:

```txt
src/sms/**
app/routes/api/twilio.inbound.ts
app/routes/api/twilio.status.ts
```

Only imports DB and REPL through stable interfaces.

### Track D — Sandbox

Owns:

```txt
src/repl/sandbox-client.ts
src/repl/jobs.ts
src/repl/languages/**
```

Does not touch Twilio route code except through exported job API.

### Track E — Auth/admin

Owns:

```txt
src/auth/**
app/routes/api/auth.$.ts
app/routes/app/admin/**
```

Does not alter SMS execution flow.

### Track F — Tests/observability/security

Owns:

```txt
src/shared/logger.ts
tests/**
*.test.ts
```

May add tests for other tracks but should avoid changing their production code without review.

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
- Use barrel exports only if they are stable.
- Prefer adding new files over editing shared files.
- Put TODOs in the owning file instead of modifying another owner’s module.

## Cross-team contracts

### SMS → REPL

```ts
await createAndRunExecutionJob({
  phoneE164,
  smsMessageId,
  language,
  code,
});
```

### REPL → DB

```ts
await db.markExecutionRunning(jobId, sandboxId);
await db.finishExecutionJob(jobId, result);
```

### REPL → SMS

```ts
await sendExecutionResultSms({
  phoneE164,
  jobId,
  result,
});
```

### Admin → DB

Read-only queries first:

```ts
listRecentMessages()
listRecentExecutionJobs()
getExecutionJob(id)
```

## Definition of done for MVP

- Deployed Worker receives a real Twilio SMS.
- User can run Python.
- User can run Java.
- Results are texted back.
- Execution history is persisted.
- Admin can inspect failures.
- Invalid webhook signatures are rejected.
- Infinite loops time out.
- Abuse limits exist.
