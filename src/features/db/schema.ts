/**
 * @file schema.ts
 * @description Placeholder schema module for the database workstream.
 * @module db
 */

/**
 * Planned table names from the common contract.
 * @remarks Other workstreams can depend on these names while migrations and ORM
 * models are implemented in the database-owned folder.
 */
export const TABLE_NAMES = [
  "users",
  "sms_identities",
  "sms_messages",
  "execution_jobs",
  "execution_outputs",
  "repl_sessions",
  "audit_events",
] as const;
