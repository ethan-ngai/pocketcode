# 03 — Better Auth + Admin Identity

## Owner

Auth/admin owner.

## Depends on

- `00-start-here-common-contract.md`
- DB schema decision from `02-neon-postgres-schema-and-data-access.md`

## Goal

Use Better Auth for web/admin authentication while keeping SMS identity separate and linkable.

## Important distinction

There are two identities:

1. **Web identity**
   - Managed by Better Auth.
   - Used for admin dashboards, logs, user linking, quota overrides, and manual execution testing.

2. **SMS identity**
   - Identified by E.164 phone number.
   - Does not require a web account for MVP.
   - May later be linked to a Better Auth user.

## Implementation tasks

### 1. Configure Better Auth

Create:

```txt
src/auth/auth.ts
app/routes/api/auth.$.ts
```

The auth route should delegate all `/api/auth/*` requests to Better Auth.

### 2. Choose provider set

MVP options:

- email/password for internal admin
- GitHub OAuth for project team
- optional magic link later

Do not block SMS MVP on public user signup.

### 3. DB adapter

Use the same Neon database if Better Auth supports the chosen Postgres adapter cleanly in Workers.

If adapter friction is high:

- use a separate Better Auth-supported store temporarily
- keep `users.id` compatible with future migration
- document the temporary split in `00-start-here-common-contract.md`

### 4. Authorization helpers

Create:

```txt
src/auth/require-admin.ts
src/auth/current-user.ts
```

Export:

```ts
export async function requireAdmin(request: Request, env: Env): Promise<AuthUser>;
export async function getOptionalUser(request: Request, env: Env): Promise<AuthUser | null>;
```

### 5. Admin roles

For MVP, use an allowlist:

```txt
ADMIN_EMAILS=ethan@example.com,teammate@example.com
```

Later migrate to DB roles:

```sql
create table user_roles (
  user_id text not null references users(id) on delete cascade,
  role text not null,
  primary key (user_id, role)
);
```

### 6. SMS linking flow

Later feature, not MVP blocker:

1. Admin logs in.
2. Admin enters phone number.
3. System sends SMS code.
4. User replies with code.
5. `sms_identities.user_id` is set.

## Security requirements

- Auth secret must be stored as a Worker secret.
- Admin-only pages must call `requireAdmin`.
- Manual `/api/repl/execute` must be admin-only.
- Do not expose raw Twilio auth token, DB URL, Sandbox IDs, or full environment dumps in UI.

## Acceptance criteria

- Admin can log in.
- Admin-only route rejects unauthenticated users.
- SMS identity can exist without a Better Auth user.
- A logged-in user can view their linked phone identities if linking is implemented.
