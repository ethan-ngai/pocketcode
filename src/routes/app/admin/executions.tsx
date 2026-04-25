/**
 * @file executions.tsx
 * @description Admin executions route wrapper.
 * @module routes
 */
import { createFileRoute } from "@tanstack/react-router";
import { getAdminExecutions } from "../../../features/admin/admin.functions";
import { ExecutionsTable } from "../../../features/admin/components/ExecutionsTable";
import { AdminGuard } from "../../../features/auth/components/AdminGuard";

/**
 * Admin executions route definition.
 * @remarks The route stays free of job queries so the REPL and admin workstreams
 * can coordinate through feature functions instead.
 */
export const Route = createFileRoute("/app/admin/executions")({
  loader: () => getAdminExecutions(),
  component: ExecutionsRoute,
});

/**
 * Renders the executions admin page.
 * @returns Guarded executions table placeholder.
 */
function ExecutionsRoute(): React.ReactElement {
  const executions = Route.useLoaderData();

  return (
    <AdminGuard>
      <ExecutionsTable executions={executions} />
    </AdminGuard>
  );
}
