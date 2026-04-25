/**
 * @file index.tsx
 * @description Admin dashboard route placeholder.
 * @module routes
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminGuard } from "../../../features/auth/components/AdminGuard";

/**
 * Admin index route definition.
 * @remarks Route-level admin checks will be added through the auth feature once
 * Better Auth has a persisted role source.
 */
export const Route = createFileRoute("/app/admin/")({
  component: AdminIndexRoute,
});

/**
 * Renders admin navigation placeholders.
 * @returns Admin dashboard links.
 * @remarks The dashboard links reserve stable paths for parallel admin table
 * work without implementing database reads in route files.
 */
function AdminIndexRoute(): React.ReactElement {
  return (
    <AdminGuard>
      <section>
        <h2>Admin</h2>
        <ul>
          <li>
            <Link to="/app/admin/messages">Messages</Link>
          </li>
          <li>
            <Link to="/app/admin/executions">Executions</Link>
          </li>
          <li>
            <Link to="/app/admin/users">Users</Link>
          </li>
        </ul>
      </section>
    </AdminGuard>
  );
}
