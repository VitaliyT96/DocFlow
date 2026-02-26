import { Injectable, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT guard adapted for GraphQL context.
 *
 * In a standard REST controller, Passport reads the Authorization header
 * from `context.switchToHttp().getRequest()`. In GraphQL, the HTTP request
 * is buried inside the GQL execution context, so we override `getRequest()`
 * to extract it.
 *
 * Usage:
 * ```ts
 * @Query(() => [DocumentType])
 * @UseGuards(GqlJwtAuthGuard)
 * async documents(): Promise<DocumentType[]> { ... }
 * ```
 */
@Injectable()
export class GqlJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Extract the underlying HTTP request from the GraphQL context
   * so Passport's JWT strategy can read the Authorization header.
   */
  getRequest(context: ExecutionContext): Request {
    const gqlCtx = GqlExecutionContext.create(context);
    return gqlCtx.getContext<{ req: Request }>().req;
  }
}
