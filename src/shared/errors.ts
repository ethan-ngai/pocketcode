/**
 * @file errors.ts
 * @description Shared application error shape for route and feature boundaries.
 * @module shared
 */

/**
 * Error with a stable code and HTTP status.
 * @remarks Route stubs and future feature modules can preserve machine-readable
 * failure codes without leaking implementation exceptions to providers or admins.
 */
export class AppError extends Error {
  /** Stable error code used by logs and API responses. */
  readonly code: string;

  /** HTTP status that best represents the failure at route boundaries. */
  readonly status: number;

  /**
   * Creates an application error.
   * @param code - Stable machine-readable error identifier.
   * @param message - Human-readable explanation safe for operators.
   * @param status - HTTP status used by route adapters.
   */
  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}
