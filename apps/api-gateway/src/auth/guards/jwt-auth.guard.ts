import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';

/**
 * JWT Authentication Guard — protects routes that require authentication.
 *
 * Usage:
 * ```ts
 * @UseGuards(JwtAuthGuard)
 * @Get('protected')
 * getProtected(): string {
 *   return 'This is protected';
 * }
 * ```
 *
 * Overrides handleRequest to provide consistent, descriptive error messages
 * instead of Passport's default "Unauthorized" string.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  /**
   * Customize error handling for JWT auth failures.
   *
   * Cases:
   * - No token provided → "Authentication token is missing"
   * - Token expired → "Authentication token has expired"
   * - Token invalid → "Invalid authentication token"
   * - Strategy threw → Forward the strategy's error message
   */
  handleRequest<TUser>(
    err: Error | null,
    user: TUser | false,
    info: Error | undefined,
  ): TUser {
    if (err) {
      this.logger.warn(`JWT auth error: ${err.message}`);
      throw new UnauthorizedException(err.message);
    }

    if (!user) {
      const message = this.getFailureMessage(info);
      this.logger.debug(`JWT auth rejected: ${message}`);
      throw new UnauthorizedException(message);
    }

    return user;
  }

  private getFailureMessage(info: Error | undefined): string {
    if (!info) {
      return 'Authentication token is missing';
    }

    if (info.name === 'TokenExpiredError') {
      return 'Authentication token has expired';
    }

    if (info.name === 'JsonWebTokenError') {
      return 'Invalid authentication token';
    }

    return info.message || 'Authentication failed';
  }
}
