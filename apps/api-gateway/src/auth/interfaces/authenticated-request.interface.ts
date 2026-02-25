import type { Request } from 'express';

/**
 * Shape of request.user after JWT validation.
 * Populated by JwtStrategy.validate() and attached by Passport.
 */
export interface RequestUser {
  userId: string;
  email: string;
}

/**
 * Express Request extended with the authenticated user from JWT.
 * Use this type in controllers that require authentication.
 */
export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
