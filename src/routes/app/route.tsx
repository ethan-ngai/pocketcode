/**
 * @file route.tsx
 * @description App route shell for authenticated web surfaces.
 * @module routes
 */
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

/**
 * App route shell definition.
 * @remarks The route reserves `/app/*` for web UI while keeping authentication
 * policy in the auth feature instead of the route file.
 */
export const Route = createFileRoute("/app")({
  component: AppRoute,
});

/**
 * Renders the web app shell.
 * @returns App navigation and nested route outlet.
 * @remarks The shell is deliberately small because admin and user flows will be
 * owned by separate feature workstreams.
 */
function AppRoute(): React.ReactElement {
  return (
    <main>
      <nav>
        <Link to="/">Home</Link> <Link to="/app/admin">Admin</Link>
      </nav>
      <h1>Pocketcode App</h1>
      <Outlet />
    </main>
  );
}
