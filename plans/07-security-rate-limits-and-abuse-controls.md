# 07 — Security, Rate Limits, and Abuse Controls

## Owner

Security/platform owner.

## Depends on

- Common contract
- SMS ingress
- Sandbox execution
- DB schema

## Goal

Keep untrusted code execution, phone abuse, and exposed webhooks under control.

## Threat model

Main risks:

1. users run malicious code
2. users run expensive infinite code
3. users spam SMS and generate Twilio cost
4. attackers forge Twilio webhooks
5. users exfiltrate app secrets through sandbox
6. users use the system as a network proxy
7. outputs leak other users' data
8. admin dashboard exposes private phone/message data

## Required controls

### Twilio webhook validation

- Validate `X-Twilio-Signature`.
- Use exact public URL when validating.
- Reject invalid signatures with 403.
- Log minimal failure metadata, not full body.

### Rate limiting

Implement a DB-backed limiter first:

```txt
key = phone_e164
window = 1 hour
limit = 20 execution commands
```

Then optionally move hot-path counters to Cloudflare KV/Durable Object if DB load becomes annoying.

### Quotas

Table idea:

```sql
create table sms_quotas (
  phone_e164 text primary key,
  hourly_limit integer not null default 20,
  daily_limit integer not null default 100,
  disabled boolean not null default false,
  reason text,
  updated_at timestamptz not null default now()
);
```

### Sandbox isolation

- No app secrets in sandbox env.
- No direct DB access from sandbox.
- No Twilio credentials in sandbox.
- Job-specific workspace.
- Timeout every command.
- Cap stdout/stderr.
- Prefer network disabled if Cloudflare Sandbox supports it.
- Clean up sandboxes after execution if possible.

### Java-specific concerns

Java can consume memory quickly. Add:

- compile timeout
- run timeout
- process kill on timeout
- memory cap if Sandbox exposes it
- reject code with suspicious process/runtime calls if needed:

```txt
Runtime.getRuntime()
ProcessBuilder
System.getenv
Files.walk("/")
```

This is not a substitute for sandboxing, only a cheap abuse filter.

### Python-specific concerns

Reject or limit:

```txt
import socket
import subprocess
import os
open("/
while True:
```

Do not overfit this. Real security comes from sandbox isolation plus hard limits.

### Admin privacy

- Mask phone numbers by default: `+1******1234`.
- Full phone numbers visible only to admins.
- Store audit events for admin views of full message bodies if this becomes public-facing.
- Do not show Twilio raw payloads in normal UI.

## Incident controls

Admin actions:

- disable phone number
- raise/lower quota
- view recent executions
- replay failed job only for admin-created test jobs
- export audit events

## Acceptance criteria

- Forged webhook rejected.
- Infinite loop times out.
- Large output is truncated.
- Disabled phone number receives a refusal and no sandbox job is created.
- Admin-only routes reject non-admins.
- Sandbox cannot read app secrets.
