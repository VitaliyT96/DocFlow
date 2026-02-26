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
import { Document } from '@docflow/database';
import type { RequestUser } from '../../auth';
import { GqlJwtAuthGuard } from '../guards/gql-auth.guard';
import { GqlCurrentUser } from '../decorators/gql-current-user.decorator';
import { GraphqlApiService } from '../graphql-api.service';
import { ProcessingJobLoader } from '../loaders';
import { DocumentType } from '../types/document.type';
import { ProcessingJobType } from '../types/processing-job.type';
import { DeleteDocumentResponseType } from '../types/delete-document-response.type';

/**
 * GraphQL resolver for Document operations.
 *
 * All queries and mutations are authenticated via GqlJwtAuthGuard
 * and scoped to the requesting user's documents.
 *
 * N+1 prevention: the `processingJobs` field is resolved via
 * ProcessingJobLoader (request-scoped DataLoader).
 */
@Resolver(() => DocumentType)
export class DocumentsResolver {
  private readonly logger = new Logger(DocumentsResolver.name);

  constructor(
    private readonly graphqlApiService: GraphqlApiService,
    private readonly processingJobLoader: ProcessingJobLoader,
  ) {}

  // ── Queries ─────────────────────────────────────────────────

  /**
   * List all documents for the authenticated user.
   *
   * ```graphql
   * query {
   *   documents {
   *     id
   *     title
   *     status
   *     processingJobs { id status progress }
   *   }
   * }
   * ```
   */
  @Query(() => [DocumentType], {
    name: 'documents',
    description: 'List all documents owned by the authenticated user',
  })
  @UseGuards(GqlJwtAuthGuard)
  async documents(
    @GqlCurrentUser() user: RequestUser,
  ): Promise<Document[]> {
    this.logger.debug(`Query documents for user ${user.userId}`);
    return this.graphqlApiService.findDocumentsByOwner(user.userId);
  }

  /**
   * Get a single document by ID.
   *
   * ```graphql
   * query {
   *   document(id: "uuid") {
   *     id
   *     title
   *     status
   *     fileUrl
   *     pageCount
   *   }
   * }
   * ```
   */
  @Query(() => DocumentType, {
    name: 'document',
    description: 'Get a single document by ID (must be owned by the authenticated user)',
  })
  @UseGuards(GqlJwtAuthGuard)
  async document(
    @Args('id', { type: () => ID, description: 'Document UUID' }) id: string,
    @GqlCurrentUser() user: RequestUser,
  ): Promise<Document> {
    this.logger.debug(`Query document ${id} for user ${user.userId}`);
    return this.graphqlApiService.findDocumentById(id, user.userId);
  }

  // ── Mutations ───────────────────────────────────────────────

  /**
   * Delete a document and all related processing jobs and annotations.
   *
   * ```graphql
   * mutation {
   *   deleteDocument(id: "uuid") {
   *     success
   *     message
   *   }
   * }
   * ```
   */
  @Mutation(() => DeleteDocumentResponseType, {
    name: 'deleteDocument',
    description: 'Delete a document and cascade to all related jobs and annotations',
  })
  @UseGuards(GqlJwtAuthGuard)
  async deleteDocument(
    @Args('id', { type: () => ID, description: 'Document UUID to delete' }) id: string,
    @GqlCurrentUser() user: RequestUser,
  ): Promise<DeleteDocumentResponseType> {
    this.logger.log(`Mutation deleteDocument(${id}) by user ${user.userId}`);
    return this.graphqlApiService.deleteDocument(id, user.userId);
  }

  // ── Field Resolvers ─────────────────────────────────────────

  /**
   * Resolve the `processingJobs` field on DocumentType using DataLoader.
   *
   * This is called once per parent document in the current request,
   * but the DataLoader batches all document IDs into a single DB query.
   */
  @ResolveField('processingJobs', () => [ProcessingJobType])
  async processingJobs(
    @Parent() document: Document,
  ): Promise<ProcessingJobType[]> {
    return this.processingJobLoader.loadByDocumentId(document.id);
  }
}
