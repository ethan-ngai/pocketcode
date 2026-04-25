/**
 * @file UsersTable.tsx
 * @description SMS identity usage table for the admin dashboard.
 * @module admin
 */
import type { AdminIdentityUsageView } from "../admin.types";

/**
 * Props for the phone usage admin table.
 * @remarks The route is named users for the product surface, but the MVP shows
 * SMS identities until Better Auth linkage owns richer user records.
 */
export interface UsersTableProps {
  /** SMS identities ranked by execution usage. */
  users: AdminIdentityUsageView[];
}

/**
 * Renders the SMS identity usage admin table.
 * @param props - Display-ready identity usage rows from the admin feature boundary.
 * @returns Phone usage table.
 */
export function UsersTable({ users }: UsersTableProps): React.ReactElement {
  if (users.length === 0) {
    return <p>No SMS users yet.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Phone</th>
          <th>Default language</th>
          <th>Executions</th>
          <th>Quota</th>
          <th>Status</th>
          <th>Last active</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <td>{user.maskedPhoneE164}</td>
            <td>{user.defaultLanguage}</td>
            <td>{user.executionCount}</td>
            <td>
              {user.hourlyLimit}/hr, {user.dailyLimit}/day
            </td>
            <td>{user.disabled ? `Disabled${formatReason(user.quotaReason)}` : "Active"}</td>
            <td>{user.lastActiveAt ? formatDate(user.lastActiveAt) : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Formats quota notes without creating an empty status suffix.
 * @param reason - Optional support note from the quota row.
 * @returns Short display suffix for disabled identities.
 */
function formatReason(reason: string | null): string {
  return reason ? `: ${reason}` : "";
}

/**
 * Formats ISO timestamps for compact admin tables.
 * @param value - ISO timestamp from a server function.
 * @returns Locale string when parseable, otherwise the original value.
 */
function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}
