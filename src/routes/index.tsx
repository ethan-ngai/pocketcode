/**
 * @file index.tsx
 * @description Public home route for the Pocketcode app.
 * @module routes
 */
import { createFileRoute, Link } from "@tanstack/react-router";

/**
 * Public index route definition.
 * @remarks The first page is intentionally plain while product flows are still
 * being split across SMS, auth, and admin workstreams.
 */
export const Route = createFileRoute("/")({
  component: IndexRoute,
});

/**
 * Renders the initial landing content.
 * @returns Public app entry point.
 * @remarks This placeholder gives local development a visible route without
 * pre-empting the later product UX plan.
 */
function IndexRoute(): React.ReactElement {
  return (
    <main>
      <h1>Pocketcode</h1>
      <p>SMS-based Python and Java execution for low-connectivity contexts.</p>
      <Link to="/app">Open app</Link>
    </main>
  );
}
