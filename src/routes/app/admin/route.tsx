/**
 * @file route.tsx
 * @description Admin route shell with server-side identity enforcement.
 * @module routes
 */
import { Outlet, createFileRoute } from "@tanstack/react-router";

import { ensureAdminSession } from "../../../features/auth/admin-route.functions";

/**
 * Admin parent route definition.
 * @remarks The parent loader protects every nested admin page with the shared
 * Better Auth allowlist check instead of duplicating auth logic per dashboard.
 */
export const Route = createFileRoute("/app/admin")({
  beforeLoad: async () => {
    await ensureAdminSession();
  },
  component: AdminRoute,
});

/**
 * Renders nested admin pages after the server-side auth check passes.
 * @returns Nested admin route outlet.
 * @remarks The UI wrapper stays empty because authorization lives in the loader
 * and the `/app` shell already owns navigation.
 */
function AdminRoute(): React.ReactElement {
  return <Outlet />;
}
