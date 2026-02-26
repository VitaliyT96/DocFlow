import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { RequestUser } from '../../auth';

/**
 * Parameter decorator that extracts the authenticated user from a
 * GraphQL execution context.
 *
 * This is the GQL equivalent of the REST `@CurrentUser()` decorator
 * defined in `auth/decorators/`. The difference is the context switch:
 * REST uses `ctx.switchToHttp().getRequest()` while GQL uses
 * `GqlExecutionContext.create(ctx).getContext().req`.
 *
 * Requires `GqlJwtAuthGuard` to be applied — otherwise `req.user` is undefined.
 *
 * Usage:
 * ```ts
 * @Query(() => [DocumentType])
 * @UseGuards(GqlJwtAuthGuard)
 * async documents(
 *   @GqlCurrentUser() user: RequestUser,
 * ): Promise<DocumentType[]> { ... }
 * ```
 */
export const GqlCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const gqlCtx = GqlExecutionContext.create(ctx);
    const request = gqlCtx.getContext<{ req: { user: RequestUser } }>().req;
    return request.user;
  },
);
