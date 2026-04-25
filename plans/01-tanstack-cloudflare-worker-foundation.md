# 01 — TanStack Start + Cloudflare Workers Foundation

## Owner

Platform/runtime owner.

## Depends on

- `00-start-here-common-contract.md`

## Goal

Stand up the TanStack Start app on Cloudflare Workers with a custom server entrypoint that can host normal web routes and API routes.

## Responsibilities

- Project scaffolding
- Cloudflare Workers compatibility
- Route file creation
- Environment binding shape
- Local dev and deployment scripts

## Implementation tasks

### 1. Create or configure TanStack Start

Install core runtime dependencies:

```sh
pnpm add @tanstack/react-start @tanstack/react-router react react-dom
pnpm add -D vite typescript wrangler @cloudflare/vite-plugin
```

Configure `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tanstackStart(), react()],
});
```

### 2. Create `wrangler.jsonc`

```jsonc
{
  "name": "sms-repl",
  "main": ".output/server/index.mjs",
  "compatibility_date": "2026-04-25",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".output/public",
  },
  "observability": {
    "enabled": true,
  },
}
```

Add Hyperdrive/Sandbox/Durable Object bindings later when those workstreams are ready.

### 3. Create route placeholders

Create empty or stub handlers:

```txt
src/routes/api/twilio.inbound.ts
src/routes/api/twilio.status.ts
src/routes/api/repl.execute.ts
src/routes/api/auth.$.ts
```

Each stub should return `501 Not Implemented` until the owner workstream fills it in.

### 4. Add a custom server entrypoint only if needed

Use the default TanStack Start server entrypoint unless Durable Objects, Queues, Cron, or Sandbox exports require a custom `src/worker.ts`.

Likely final need:

```ts
import handler from "@tanstack/react-start/server-entry";

export { Sandbox } from "@cloudflare/sandbox";

export default {
  fetch: handler.fetch,
};
```

### 5. Scripts

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "deploy": "wrangler deploy",
    "cf-typegen": "wrangler types",
    "check": "tsc --noEmit"
  }
}
```

### 3.5. Create feature folders before implementation

Create empty folders and placeholder barrel/comment files only where needed:

```txt
src/features/auth/
src/features/db/
src/features/sms/
src/features/repl/
src/features/admin/
src/features/observability/
src/features/security/
src/shared/
```

Do not put implementation logic in route files. Route files call feature-level `*.functions.ts` exports or render feature components.

## Local dev checklist

- `pnpm dev` starts TanStack Start.
- `pnpm build` emits `.output`.
- `pnpm deploy` deploys to Workers.
- Route stubs respond.
- Cloudflare binding types compile.

## Do not own

- DB schema
- Twilio signature validation details
- Sandbox command implementation
- Better Auth provider logic
- Admin UI beyond a placeholder page
