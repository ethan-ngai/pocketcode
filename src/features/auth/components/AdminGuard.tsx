/**
 * @file AdminGuard.tsx
 * @description Placeholder admin guard component for protected UI routes.
 * @module auth
 */
import type { PropsWithChildren } from "react";

/**
 * Renders children until Better Auth-backed route protection is wired.
 * @param props - Child content that belongs behind the admin boundary.
 * @returns The protected child subtree.
 * @remarks The component marks admin ownership in the UI tree without inventing
 * temporary auth behavior that future work would need to unwind.
 */
export function AdminGuard({ children }: PropsWithChildren): React.ReactNode {
  return children;
}
