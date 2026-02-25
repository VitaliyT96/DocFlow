import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../interfaces';

/**
 * Parameter decorator that extracts the authenticated user from the request.
 *
 * Usage:
 * ```ts
 * @Get('me')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: RequestUser): Promise<UserProfileDto> {
 *   return this.authService.getProfile(user.userId);
 * }
 * ```
 *
 * Requires JwtAuthGuard to be applied — otherwise request.user is undefined.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    return request.user;
  },
);
