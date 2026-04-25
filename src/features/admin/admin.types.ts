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

/**
 * SMS message row prepared for normal admin display.
 * @remarks Raw provider payloads and full phone numbers stay out of the default
 * dashboard view until real admin authorization and auditing are wired.
 */
export interface AdminMessageView {
  /** Stable SMS message id. */
  id: string;
  /** Inbound or outbound direction. */
  direction: string;
  /** Masked phone number safe for default admin tables. */
  maskedPhoneE164: string;
  /** User-visible SMS body, if stored. */
  body: string | null;
  /** Provider delivery or processing status. */
  status: string | null;
  /** Creation timestamp serialized for client rendering. */
  createdAt: string;
}

/**
 * Execution job row prepared for admin inspection.
 * @remarks Code is included because the dashboard is intended for debugging
 * execution history, but phone numbers remain masked by default.
 */
export interface AdminExecutionView {
  /** Stable execution job id. */
  id: string;
  /** Masked phone number when the job came from SMS. */
  maskedPhoneE164: string | null;
  /** Runtime used by the job. */
  language: string;
  /** Submitted source code. */
  code: string;
  /** Current lifecycle status. */
  status: string;
  /** Runtime duration when available. */
  durationMs: number | null;
  /** Machine-readable error code when available. */
  errorCode: string | null;
  /** Creation timestamp serialized for client rendering. */
  createdAt: string;
}

/**
 * Phone usage row prepared for admin dashboard ranking.
 * @remarks This supports the MVP "top phone numbers by usage" view without
 * exposing unmasked phone numbers in normal UI.
 */
export interface AdminIdentityUsageView {
  /** Stable SMS identity id. */
  id: string;
  /** Masked phone number safe for normal admin tables. */
  maskedPhoneE164: string;
  /** Current prefix-free default language. */
  defaultLanguage: string;
  /** Number of execution jobs associated with the identity. */
  executionCount: number;
  /** Last active timestamp serialized for client rendering. */
  lastActiveAt: string | null;
}

/**
 * Data shown on the admin dashboard landing page.
 * @remarks The dashboard intentionally summarizes the same tables that dedicated
 * admin pages expose in more detail.
 */
export interface AdminDashboardData {
  /** Recent inbound and outbound SMS messages. */
  recentMessages: AdminMessageView[];
  /** Recent execution jobs across statuses. */
  recentExecutions: AdminExecutionView[];
  /** Recent failed execution jobs for quick triage. */
  failedExecutions: AdminExecutionView[];
  /** Phone identities with the most execution usage. */
  topPhoneNumbers: AdminIdentityUsageView[];
}
