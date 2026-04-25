/**
 * @file messages.tsx
 * @description Admin messages route wrapper.
 * @module routes
 */
import { createFileRoute } from "@tanstack/react-router";
import { AdminGuard } from "../../../features/auth/components/AdminGuard";
import { MessagesTable } from "../../../features/admin/components/MessagesTable";
import { getAdminMessages } from "../../../features/admin/admin.functions";

/**
 * Admin messages route definition.
 * @remarks The route delegates display to the admin feature so provider message
 * persistence can evolve without route-level rewrites.
 */
export const Route = createFileRoute("/app/admin/messages")({
  loader: () => getAdminMessages(),
  component: MessagesRoute,
});

/**
 * Renders the messages admin page.
 * @returns Guarded messages table placeholder.
 */
function MessagesRoute(): React.ReactElement {
  const messages = Route.useLoaderData();

  return (
    <AdminGuard>
      <MessagesTable messages={messages} />
    </AdminGuard>
  );
}
