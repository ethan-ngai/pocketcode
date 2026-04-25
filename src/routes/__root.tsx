/**
 * @file __root.tsx
 * @description Root TanStack route for the Shebang app shell.
 * @module routes
 */
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";

/**
 * Root route definition used by TanStack Start.
 * @remarks The root shell stays minimal so feature teams can build admin and app
 * routes without fighting global layout assumptions.
 */
export const Route = createRootRoute({
  component: RootComponent,
});

/**
 * Renders the document shell expected by TanStack Start.
 * @returns HTML document with the routed application outlet.
 * @remarks Keeping the document here avoids feature routes owning global script
 * injection or head rendering details.
 */
function RootComponent(): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
