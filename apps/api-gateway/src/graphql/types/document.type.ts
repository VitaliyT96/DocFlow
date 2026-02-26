import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { DocumentStatus } from '@docflow/database';
import { ProcessingJobType } from './processing-job.type';

/**
 * GraphQL ObjectType for Document.
 *
 * Decoupled from the TypeORM entity to keep the API contract independent
 * of the DB schema. The `processingJobs` field is resolved via DataLoader
 * in the resolver, not eagerly loaded.
 */
@ObjectType('Document')
export class DocumentType {
  @Field(() => ID, { description: 'Unique document identifier (UUID)' })
  id!: string;

  @Field(() => String, { description: 'Display title of the document' })
  title!: string;

  @Field(() => String, { description: 'Object key / URL in storage' })
  fileUrl!: string;

  @Field(() => String, { description: 'MIME type of the uploaded file' })
  mimeType!: string;

  /**
   * PostgreSQL bigint comes back as string from the pg driver.
   * We expose it as String in GraphQL since JS numbers lose precision
   * above Number.MAX_SAFE_INTEGER.
   */
  @Field(() => String, { description: 'File size in bytes (string to avoid JS precision loss)' })
  fileSize!: string;

  @Field(() => DocumentStatus, { description: 'Current lifecycle status' })
  status!: DocumentStatus;

  @Field(() => Int, {
    nullable: true,
    description: 'Number of pages (set after processing completes)',
  })
  pageCount!: number | null;

  @Field(() => String, { description: 'Owner user ID (UUID)' })
  ownerId!: string;

  @Field(() => Date, { description: 'Timestamp when document was created' })
  createdAt!: Date;

  @Field(() => Date, { description: 'Timestamp when document was last updated' })
  updatedAt!: Date;

  /**
   * Resolved via DataLoader in DocumentsResolver.
   * The field is declared here so GraphQL knows it exists in the schema,
   * but the actual data loading happens in the @ResolveField() handler.
   */
  @Field(() => [ProcessingJobType], { description: 'Processing jobs associated with this document' })
  processingJobs?: ProcessingJobType[];
}
