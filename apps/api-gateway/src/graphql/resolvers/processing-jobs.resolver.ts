import {
  Resolver,
  Query,
  Mutation,
  ResolveField,
  Parent,
  Args,
  ID,
} from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { ProcessingJob } from '@docflow/database';
import type { RequestUser } from '../../auth';
import { GqlJwtAuthGuard } from '../guards/gql-auth.guard';
import { GqlCurrentUser } from '../decorators/gql-current-user.decorator';
import { GraphqlApiService } from '../graphql-api.service';
import { DocumentLoader } from '../loaders';
import { ProcessingJobType } from '../types/processing-job.type';
import { DocumentType } from '../types/document.type';

/**
 * GraphQL resolver for ProcessingJob operations.
 *
 * All queries and mutations are authenticated via GqlJwtAuthGuard.
 * Ownership is enforced through the parent document's ownerId.
 *
 * N+1 prevention: the `document` field is resolved via
 * DocumentLoader (request-scoped DataLoader).
 */
@Resolver(() => ProcessingJobType)
export class ProcessingJobsResolver {
  private readonly logger = new Logger(ProcessingJobsResolver.name);

  constructor(
    private readonly graphqlApiService: GraphqlApiService,
    private readonly documentLoader: DocumentLoader,
  ) {}

  // ── Queries ─────────────────────────────────────────────────

  /**
   * Get a single processing job by ID.
   * Ownership is verified via the parent document.
   *
   * ```graphql
   * query {
   *   processingJob(id: "uuid") {
   *     id
   *     status
   *     progress
   *     errorMessage
   *     document { id title }
   *   }
   * }
   * ```
   */
  @Query(() => ProcessingJobType, {
    name: 'processingJob',
    description: 'Get a single processing job by ID (parent document must be owned by the authenticated user)',
  })
  @UseGuards(GqlJwtAuthGuard)
  async processingJob(
    @Args('id', { type: () => ID, description: 'Processing job UUID' }) id: string,
    @GqlCurrentUser() user: RequestUser,
  ): Promise<ProcessingJob> {
    this.logger.debug(`Query processingJob ${id} for user ${user.userId}`);
    return this.graphqlApiService.findProcessingJobById(id, user.userId);
  }

  // ── Mutations ───────────────────────────────────────────────

  /**
   * Retry a failed processing job.
   * Resets the job to PENDING and dispatches a gRPC call to the worker.
   *
   * ```graphql
   * mutation {
   *   retryProcessing(jobId: "uuid") {
   *     id
   *     status
   *     progress
   *   }
   * }
   * ```
   */
  @Mutation(() => ProcessingJobType, {
    name: 'retryProcessing',
    description: 'Retry a failed processing job (resets to PENDING and dispatches to worker)',
  })
  @UseGuards(GqlJwtAuthGuard)
  async retryProcessing(
    @Args('jobId', { type: () => ID, description: 'Processing job UUID to retry' }) jobId: string,
    @GqlCurrentUser() user: RequestUser,
  ): Promise<ProcessingJob> {
    this.logger.log(
      `Mutation retryProcessing(${jobId}) by user ${user.userId}`,
    );
    return this.graphqlApiService.retryProcessing(jobId, user.userId);
  }

  // ── Field Resolvers ─────────────────────────────────────────

  /**
   * Resolve the `document` field on ProcessingJobType using DataLoader.
   *
   * Returns the parent document for a given job. Uses DataLoader to
   * batch multiple document lookups into a single query.
   */
  @ResolveField('document', () => DocumentType, {
    nullable: true,
    description: 'Parent document that this job belongs to',
  })
  async document(
    @Parent() job: ProcessingJob,
  ): Promise<DocumentType | null> {
    return this.documentLoader.loadById(job.documentId);
  }
}
