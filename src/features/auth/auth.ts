/**
 * @file auth.ts
 * @description Auth composition boundary reserved for Better Auth configuration.
 * @module auth
 */

/**
 * Auth feature readiness marker.
 * @remarks Exporting a named boundary now prevents later work from scattering
 * Better Auth setup across unrelated route files.
 */
export const authFeatureReady = false;
