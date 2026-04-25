/**
 * @file vite.config.ts
 * @description Vite and TanStack Start runtime configuration for the Worker app.
 * @module platform
 */
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Configures TanStack Start to build for Cloudflare Workers.
 * @remarks The Cloudflare plugin owns the SSR environment so route handlers can
 * compile against Worker APIs before feature work adds bindings like Hyperdrive.
 */
export default defineConfig({
  fmt: {
    ignorePatterns: [],
  },
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tanstackStart(), react()],
});
