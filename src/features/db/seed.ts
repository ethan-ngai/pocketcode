/**
 * @file seed.ts
 * @description Seed entrypoint reserved for database-owned development fixtures.
 * @module db
 */

/**
 * Placeholder seed runner.
 * @returns Promise that resolves without creating data.
 * @remarks A committed entrypoint prevents future setup scripts from inventing
 * a second seed location outside the database feature boundary.
 */
export async function seedDatabase(): Promise<void> {
  return undefined;
}
