# Pocketcode

Pocketcode is an SMS-based REPL that lets people run Python and Java from any phone. Users text code to an SMS8-connected number, Pocketcode executes it in a Cloudflare Sandbox container, and the result is sent back by SMS.

The app is built with TanStack Start on Cloudflare Workers, Better Auth for admin access, Neon Postgres with Drizzle, SMS8 for inbound and outbound SMS, and Cloudflare Sandbox for isolated code execution.

## Features

- Public landing page and SMS signup flow.
- Inbound SMS command handling for Python and Java snippets.
- Secure sandboxed execution with configurable timeout and output limits.
- Postgres persistence for SMS messages, identities, sessions, quotas, execution jobs, and outputs.
- Admin pages for users, messages, and executions.

## Prerequisites

- Node.js 22 or newer.
- pnpm 10.33.2 or newer.
- Docker Desktop, required for local Cloudflare Sandbox containers.
- A Postgres database, such as Neon.
- SMS8 API credentials and at least one configured Android device route.
- Wrangler access for Cloudflare deployment.

## Setup

Install dependencies:

```sh
pnpm install
```

Create `.dev.vars` with the required local Cloudflare bindings:

```sh
DATABASE_URL="postgres://..."
BETTER_AUTH_SECRET="replace-with-a-long-random-secret"
BETTER_AUTH_URL="http://localhost:5173"
APP_BASE_URL="http://localhost:5173"

SMS8_API_KEY="replace-with-your-sms8-api-key"
SMS8_DEVICES='["182|0"]'
SMS8_PRIORITIZE="false"

ADMIN_EMAILS="you@example.com"
SMS_ALLOWLIST="+15551234567"
SMS8_WEBHOOK_AUTH_ENABLED="false"
ENVIRONMENT="development"
```

Optional execution settings:

```sh
EXECUTION_TIMEOUT_MS="5000"
EXECUTION_MAX_OUTPUT_CHARS="4000"
```

Apply the SQL migrations in `src/features/db/migrations` to your Postgres database before using the SMS or admin features.

## Development

Start the local dev server:

```sh
pnpm dev
```

The app runs at `http://localhost:5173`. On first start, the Cloudflare dev runtime builds the sandbox container from `Dockerfile`, including Python and Java support.

Run type checking:

```sh
pnpm check
```

Run tests:

```sh
pnpm test
```

Generate new Drizzle migrations after schema changes:

```sh
pnpm db:generate
```

Generate Cloudflare binding types:

```sh
pnpm cf-typegen
```

Build for production:

```sh
pnpm build
```

Deploy to Cloudflare:

```sh
pnpm deploy
```

## SMS8 Webhooks

Point your SMS8 inbound webhook at:

```text
https://your-domain.example/api/sms8/inbound
```

For local webhook testing, expose `http://localhost:5173` with a tunnel and set `APP_BASE_URL` and `BETTER_AUTH_URL` to the public tunnel URL.

SMS8 signs the raw `messages` form payload with the `x-sg-signature` header. In local development, `SMS8_WEBHOOK_AUTH_ENABLED="false"` is useful when testing through tunnels. Keep webhook validation enabled in production.
