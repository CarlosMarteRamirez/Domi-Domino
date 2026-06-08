/**
 * A lightweight Result type used across the domain to make failures explicit
 * instead of throwing for expected, recoverable errors (invalid moves, etc.).
 */
export type Result<T, E = DomainError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const domainError = (code: string, message: string) => new DomainError(code, message);
