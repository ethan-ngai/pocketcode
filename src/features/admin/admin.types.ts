/**
 * @file admin.types.ts
 * @description Admin feature contracts for dashboard workstreams.
 * @module admin
 */

/**
 * Generic admin list page contract.
 * @remarks Admin tables will specialize this shape while preserving predictable
 * pagination inputs across messages, users, and execution views.
 */
export interface AdminListQuery {
  /** Maximum number of rows to return. */
  limit: number;
  /** Opaque cursor from the previous page. */
  cursor?: string;
}
