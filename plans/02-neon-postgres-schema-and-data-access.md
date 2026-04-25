# 02 — Neon Postgres Schema + Data Access

## Owner

Database/backend owner.

## Depends on

- `00-start-here-common-contract.md`
- Worker foundation for binding names

## Goal

Create the durable data model for SMS identity, messages, execution jobs, outputs, sessions, and audit logs.

## Recommended access layer

Use one of:

1. **Drizzle ORM + Postgres.js/pg through Hyperdrive**
2. **Drizzle ORM + Neon serverless driver**

Prefer Hyperdrive in production because Cloudflare and Neon both recommend it for pooled Workers-to-Postgres access.

## Tables

### `users`

Owned mostly by Better Auth. If Better Auth creates its own user table, map this plan to its exact generated schema. Do not maintain two disconnected user concepts.

Required app-level fields:

```sql
id text primary key,
email text unique,
name text,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

### `sms_identities`

Maps phone numbers to users or anonymous SMS-only users.

```sql
create table sms_identities (
  id text primary key,
  user_id text references users(id) on delete set null,
  phone_e164 text not null unique,
  default_language text not null default 'python',
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### `sms_messages`

Stores inbound and outbound SMS events.

```sql
create table sms_messages (
  id text primary key,
  direction text not null check (direction in ('inbound', 'outbound')),
  provider text not null default 'twilio',
  provider_message_sid text unique,
  phone_e164 text not null,
  body text,
  status text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index sms_messages_phone_created_idx
  on sms_messages (phone_e164, created_at desc);
```

### `repl_sessions`

Tracks per-phone state.

```sql
create table repl_sessions (
  id text primary key,
  sms_identity_id text not null references sms_identities(id) on delete cascade,
  language text not null check (language in ('python', 'java')),
  status text not null default 'active',
  state jsonb not null default '{}'::jsonb,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index repl_sessions_identity_active_idx
  on repl_sessions (sms_identity_id, status, last_active_at desc);
```

### `execution_jobs`

```sql
create table execution_jobs (
  id text primary key,
  sms_message_id text references sms_messages(id) on delete set null,
  sms_identity_id text references sms_identities(id) on delete set null,
  language text not null check (language in ('python', 'java')),
  code text not null,
  status text not null check (
    status in ('queued', 'running', 'succeeded', 'failed', 'timed_out', 'rejected')
  ),
  timeout_ms integer not null,
  max_output_chars integer not null,
  sandbox_id text,
  exit_code integer,
  duration_ms integer,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index execution_jobs_identity_created_idx
  on execution_jobs (sms_identity_id, created_at desc);
```

### `execution_outputs`

```sql
create table execution_outputs (
  id text primary key,
  execution_job_id text not null references execution_jobs(id) on delete cascade,
  stdout text not null default '',
  stderr text not null default '',
  combined_preview text not null default '',
  was_truncated boolean not null default false,
  created_at timestamptz not null default now()
);
```

### `audit_events`

```sql
create table audit_events (
  id text primary key,
  actor_user_id text references users(id) on delete set null,
  actor_phone_e164 text,
  event_type text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

## Data access API

Create `src/db/client.ts`:

```ts
export interface Db {
  findOrCreateSmsIdentity(phoneE164: string): Promise<SmsIdentity>;
  insertInboundSms(input: InsertSmsMessage): Promise<SmsMessage>;
  createExecutionJob(input: CreateExecutionJobInput): Promise<ExecutionJob>;
  markExecutionRunning(id: string, sandboxId?: string): Promise<void>;
  finishExecutionJob(id: string, result: ExecutionResult): Promise<void>;
  getActiveSession(identityId: string): Promise<ReplSession | null>;
  upsertSessionLanguage(identityId: string, language: ReplLanguage): Promise<void>;
}
```

Keep this API stable so the SMS and sandbox teams can work without touching schema internals.

## Migration workflow

- Use generated SQL migrations committed to `src/db/migrations`.
- Never edit a migration after it has been applied to shared dev/prod.
- Use Neon branches for PR testing.
- Add seed data only in `src/db/seed.ts`.

## Acceptance criteria

- Migrations apply to a fresh Neon branch.
- `findOrCreateSmsIdentity` is idempotent.
- Inserting duplicate Twilio `MessageSid` does not create duplicate inbound messages.
- Execution job lifecycle can go from `queued` → `running` → terminal status.
