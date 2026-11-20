/**
 * An error the API reports to the client as-is (docs/API_CONTRACTS.md §1).
 * Anything that is not an AppError becomes a generic 500 INTERNAL response.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}
