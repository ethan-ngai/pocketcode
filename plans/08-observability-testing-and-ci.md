# 08 — Observability, Testing, and CI

## Owner

QA/platform owner.

## Depends on

- All route names from common contract
- DB client API
- SMS parser
- Sandbox client

## Goal

Make the system testable without real Twilio messages or real user code execution on every test run.

## Logging

Create:

```txt
src/shared/logger.ts
```

Log structured events:

```ts
logger.info("sms.inbound.received", {
  messageSid,
  phoneHash,
});

logger.info("execution.finished", {
  jobId,
  language,
  status,
  durationMs,
  stdoutChars,
  stderrChars,
});
```

Never log:

- Twilio auth token
- Better Auth secret
- DB URL
- full phone number in non-debug logs
- full code body in production logs unless explicitly enabled

## Tests

### Unit tests

- `src/sms/parser.test.ts`
- `src/sms/responder.test.ts`
- `src/repl/languages/java.test.ts`
- `src/repl/languages/python.test.ts`
- `src/shared/env.test.ts`

Parser cases:

```txt
help
reset
lang py
lang python
lang java
py print("hi")
python print("hi")
java System.out.println("hi");
print("default language")
```

### Integration tests

- inbound webhook with mocked Twilio signature
- duplicate MessageSid idempotency
- DB job lifecycle
- sandbox smoke tests behind opt-in flag:

```txt
RUN_SANDBOX_TESTS=true
```

### Contract tests

Add tests that ensure shared `ExecutionRequest` and `ExecutionResult` are stable enough for all workstreams.

## Local Twilio testing

Use one of:

- Twilio test webhook payloads
- local tunnel to Worker dev server
- direct POST with signature validation disabled in dev

Recommended local command:

```sh
curl -X POST http://localhost:5173/api/twilio/inbound   -H "Content-Type: application/x-www-form-urlencoded"   --data-urlencode "From=+15555550123"   --data-urlencode "To=+15555550999"   --data-urlencode "Body=py print(2+2)"   --data-urlencode "MessageSid=SM_TEST_1"
```

## CI

Minimum checks:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Optional:

- create Neon branch per PR
- apply migrations
- run integration tests
- delete Neon branch

## Monitoring

Cloudflare:

- Worker errors
- CPU time
- request count
- route latency
- logs for webhook 403s

App metrics:

- executions per hour
- timeout rate
- failure rate by language
- Twilio delivery failures
- average sandbox duration
- top quota-limited phone hashes

DB health:

- slow queries
- connection count
- migration status
- storage growth from outputs

## Acceptance criteria

- Unit tests cover parser and response chunking.
- CI fails on type errors.
- Build succeeds before deploy.
- A mocked inbound SMS can run through the full app flow without Twilio.
- Production logs contain enough job IDs to debug without exposing secrets.
