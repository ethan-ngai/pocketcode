/**
 * @file index.tsx
 * @description Admin dashboard route placeholder.
 * @module routes
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminGuard } from "../../../features/auth/components/AdminGuard";
import { getAdminDashboardData } from "../../../features/admin/admin.functions";
import { ExecutionsTable } from "../../../features/admin/components/ExecutionsTable";
import { MessagesTable } from "../../../features/admin/components/MessagesTable";
import { UsersTable } from "../../../features/admin/components/UsersTable";

/**
 * Admin index route definition.
 * @remarks Route-level admin checks will be added through the auth feature once
 * Better Auth has a persisted role source.
 */
export const Route = createFileRoute("/app/admin/")({
  loader: () => getAdminDashboardData(),
  component: AdminIndexRoute,
});

/**
 * Renders admin navigation placeholders.
 * @returns Admin dashboard links.
 * @remarks The dashboard links reserve stable paths for parallel admin table
 * work without implementing database reads in route files.
 */
function AdminIndexRoute(): React.ReactElement {
  const dashboard = Route.useLoaderData();

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
        <h3>Recent Messages</h3>
        <MessagesTable messages={dashboard.recentMessages} />
        <h3>Recent Executions</h3>
        <ExecutionsTable executions={dashboard.recentExecutions} />
        <h3>Failed Jobs</h3>
        <ExecutionsTable executions={dashboard.failedExecutions} />
        <h3>Top Phone Numbers</h3>
        <UsersTable users={dashboard.topPhoneNumbers} />
        <h3>Manual Test Execution</h3>
        <p>Use the reserved internal endpoint at /api/repl/execute for smoke tests.</p>
      </section>
    </AdminGuard>
  );
}
