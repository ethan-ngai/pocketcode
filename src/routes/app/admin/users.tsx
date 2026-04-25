/**
 * @file users.tsx
 * @description Admin users route wrapper.
 * @module routes
 */
import { createFileRoute } from "@tanstack/react-router";
import { UsersTable } from "../../../features/admin/components/UsersTable";
import { AdminGuard } from "../../../features/auth/components/AdminGuard";

/**
 * Admin users route definition.
 * @remarks Better Auth owns the eventual user schema, so the route only exposes
 * a stable UI location for that workstream.
 */
export const Route = createFileRoute("/app/admin/users")({
  component: UsersRoute,
});

/**
 * Renders the users admin page.
 * @returns Guarded users table placeholder.
 */
function UsersRoute(): React.ReactElement {
  return (
    <AdminGuard>
      <UsersTable />
    </AdminGuard>
  );
}
