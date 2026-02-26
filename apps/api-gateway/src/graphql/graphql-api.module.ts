import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document, ProcessingJob } from '@docflow/database';
import { GrpcClientModule } from '../grpc/grpc-client.module';
import { GraphqlApiService } from './graphql-api.service';
import { DocumentsResolver } from './resolvers/documents.resolver';
import { ProcessingJobsResolver } from './resolvers/processing-jobs.resolver';
import { ProcessingJobLoader, DocumentLoader } from './loaders';

// Side-effect: register GraphQL enums before Apollo builds the schema
import './enums';

/**
 * GraphqlApiModule — feature module for GraphQL queries and mutations.
 *
 * Provides:
 *   - DocumentsResolver:       queries/mutations for documents
 *   - ProcessingJobsResolver:  queries/mutations for processing jobs
 *   - GraphqlApiService:       business logic (owner-scoped access)
 *   - DataLoaders:             request-scoped N+1 prevention
 *
 * Imports:
 *   - TypeOrmModule.forFeature: Document + ProcessingJob repositories
 *   - GrpcClientModule: for retryProcessing mutation gRPC dispatch
 *
 * Note: The Apollo GraphQL driver is configured globally in AppModule.
 * This module only adds resolvers, types, and business logic.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Document, ProcessingJob]),
    GrpcClientModule,
  ],
  providers: [
    // Service
    GraphqlApiService,

    // Resolvers
    DocumentsResolver,
    ProcessingJobsResolver,

    // DataLoaders (request-scoped)
    ProcessingJobLoader,
    DocumentLoader,
  ],
})
export class GraphqlApiModule {}
