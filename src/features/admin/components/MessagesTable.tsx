/**
 * @file MessagesTable.tsx
 * @description Messages table for the admin dashboard.
 * @module admin
 */
import type { AdminMessageView } from "../admin.types";

/**
 * Props for the messages admin table.
 * @remarks Rows are already masked and stripped of raw provider payloads by the
 * admin server-function boundary.
 */
export interface MessagesTableProps {
  /** Recent inbound and outbound SMS events to render. */
  messages: AdminMessageView[];
}

/**
 * Renders the messages admin table.
 * @param props - Display-ready message rows from the admin feature boundary.
 * @returns Recent SMS message table.
 */
export function MessagesTable({ messages }: MessagesTableProps): React.ReactElement {
  if (messages.length === 0) {
    return <p>No SMS messages yet.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Created</th>
          <th>Direction</th>
          <th>Phone</th>
          <th>Status</th>
          <th>Body</th>
        </tr>
      </thead>
      <tbody>
        {messages.map((message) => (
          <tr key={message.id}>
            <td>{formatDate(message.createdAt)}</td>
            <td>{message.direction}</td>
            <td>{message.maskedPhoneE164}</td>
            <td>{message.status ?? "unknown"}</td>
            <td>{message.body ?? ""}</td>
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
