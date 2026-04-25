/**
 * @file vitest.config.ts
 * @description Test runner configuration for feature-level and integration tests.
 * @module platform
 */
import { defineConfig } from "vitest/config";

/**
 * Configures Vitest without the application Vite plugins.
 * @remarks Unit tests import feature modules directly; avoiding the Cloudflare
 * and TanStack plugins keeps tests fast and independent from Worker bundling.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    restoreMocks: true,
  },
});
