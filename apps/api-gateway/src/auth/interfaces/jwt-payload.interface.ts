/**
 * JWT token payload structure.
 *
 * `sub` follows the JWT standard claim for subject identifier.
 * This payload is signed into every access token and verified on each request.
 */
export interface JwtPayload {
  /** User ID (UUID) — maps to User.id */
  sub: string;

  /** User email — included for convenience, but sub is the canonical identifier */
  email: string;
}
