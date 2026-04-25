/**
 * @file drizzle.config.ts
 * @description Drizzle Kit migration configuration for the Neon Postgres schema.
 * @module db
 */
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 * @remarks Migrations live inside the database feature folder so schema changes
 * stay owned by the same workstream as the access layer.
 */
export default defineConfig({
  schema: "./src/features/db/schema.ts",
  out: "./src/features/db/migrations",
  dialect: "postgresql",
});
