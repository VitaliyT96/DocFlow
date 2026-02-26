import { ConflictException } from '@nestjs/common';

/**
 * Thrown when attempting to register a user with an email
 * that already exists in the database.
 *
 * HTTP 409 Conflict — the request conflicts with the current
 * state of the resource (existing user).
 */
export class EmailAlreadyExistsException extends ConflictException {
  constructor(email: string) {
    super({
      statusCode: 409,
      error: 'Conflict',
      message: `User with email "${email}" already exists`,
    });
  }
}
