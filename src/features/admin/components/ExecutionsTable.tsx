/**
 * @file ExecutionsTable.tsx
 * @description Execution table for the admin dashboard.
 * @module admin
 */
import type { AdminExecutionView } from "../admin.types";

/**
 * Props for the execution admin table.
 * @remarks Keeping display rows simple avoids a table dependency while the MVP
 * proves which execution fields admins actually need.
 */
export interface ExecutionsTableProps {
  /** Recent execution jobs to render. */
  executions: AdminExecutionView[];
}

/**
 * Renders the execution admin table.
 * @param props - Display-ready execution rows from the admin feature boundary.
 * @returns Recent execution job table.
 */
export function ExecutionsTable({ executions }: ExecutionsTableProps): React.ReactElement {
  if (executions.length === 0) {
    return <p>No execution jobs yet.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Created</th>
          <th>Status</th>
          <th>Language</th>
          <th>Duration</th>
          <th>Error</th>
          <th>Code</th>
        </tr>
      </thead>
      <tbody>
        {executions.map((execution) => (
          <tr key={execution.id}>
            <td>{formatDate(execution.createdAt)}</td>
            <td>{execution.status}</td>
            <td>{execution.language}</td>
            <td>{execution.durationMs === null ? "" : `${execution.durationMs}ms`}</td>
            <td>{execution.errorCode ?? ""}</td>
            <td>
              <code>{execution.code}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
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
