import { UnauthorizedException } from '@nestjs/common';

/**
 * Thrown when login credentials are invalid (wrong email or password).
 *
 * HTTP 401 Unauthorized — intentionally vague message to prevent
 * user enumeration attacks.
 */
export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid email or password',
    });
  }
}
