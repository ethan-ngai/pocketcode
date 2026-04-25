# 04 — Twilio SMS Ingress/Egress

## Owner

SMS integration owner.

## Depends on

- `00-start-here-common-contract.md`
- DB API from `02-neon-postgres-schema-and-data-access.md`
- Sandbox enqueue/execute API from `05-cloudflare-sandbox-execution.md`

## Goal

Receive inbound SMS, parse commands, create execution jobs, and send results back through Twilio.

## Inbound route

Path:

```txt
POST /api/twilio/inbound
```

Responsibilities:

1. Validate Twilio signature.
2. Parse form body.
3. Extract:
   - `From`
   - `To`
   - `Body`
   - `MessageSid`
   - full raw payload
4. Store inbound message.
5. Resolve or create `sms_identities` row.
6. Parse command.
7. Dispatch to command handler.
8. Return TwiML quickly.

## Twilio signature validation

Create:

```txt
src/sms/signatures.ts
```

Export:

```ts
export async function validateTwilioRequest(
  request: Request,
  env: Env,
  parsedBody: URLSearchParams
): Promise<boolean>;
```

Fail closed in production. Allow bypass only when:

```txt
TWILIO_WEBHOOK_AUTH_ENABLED=false
```

and current environment is local/dev.

## Parser

Create:

```txt
src/sms/parser.ts
```

Rules:

```txt
help                  -> help
reset                 -> reset
lang py               -> set_language python
lang python           -> set_language python
lang java             -> set_language java
py <code>             -> execute python
python <code>         -> execute python
java <code>           -> execute java
<code>                -> execute default session language
```

Ambiguity rule:

- If no default language is set, default to Python.

## Response strategy

Twilio expects a TwiML response to inbound webhooks.

For MVP:

- For cheap commands like `help`, reply immediately in TwiML.
- For execution commands, return:

```xml
<Response><Message>Running code...</Message></Response>
```

Then send final result using Twilio REST API.

Alternative:

- Return `<Response></Response>` to avoid double texts, but then the first user-visible feedback is delayed.

## Outbound route

Path:

```txt
POST /api/twilio/status
```

Responsibilities:

- Validate Twilio signature.
- Store status update in `sms_messages` or update outbound message row.
- Do not trigger execution.

## Outbound sender

Create:

```txt
src/sms/twilio.ts
```

Export:

```ts
export async function sendSms(input: {
  to: string;
  body: string;
  env: Env;
  statusCallbackUrl?: string;
}): Promise<{ providerMessageSid: string }>;
```

Implementation detail:

- Use Twilio REST API with Basic Auth.
- Use `MessagingServiceSid` if configured; otherwise use `From`.

## Output chunking

Create:

```txt
src/sms/responder.ts
```

Rules:

- hard max chunk: 1,400 chars
- maximum chunks for MVP: 2
- prefix:
  - success: `✅ Output:
`
  - stderr-only failure: `Error:
`
  - timeout: `Timed out after 5s.`
- store full output in DB even when SMS is truncated

## Command behavior

### `help`

Return:

```txt
Commands:
py <code>
java <code>
lang py
lang java
reset
```

### `reset`

Clear active session state and reply:

```txt
Session reset.
```

### `lang`

Update default language and reply:

```txt
Default language set to Python.
```

### `execute`

Create execution job and call sandbox execution service.

## Acceptance criteria

- Valid Twilio webhook creates one inbound message row.
- Duplicate `MessageSid` is idempotent.
- Invalid signature receives 403.
- `help`, `lang`, and `reset` complete without sandbox.
- `py print("hi")` sends final output SMS.
- Large output is truncated safely.
