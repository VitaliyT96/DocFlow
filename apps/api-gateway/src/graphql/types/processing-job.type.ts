import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { ProcessingJobStatus } from '@docflow/database';

/**
 * GraphQL ObjectType for ProcessingJob.
 *
 * The `document` field is resolved via DataLoader in the resolver
 * to avoid N+1 queries when listing jobs.
 */
@ObjectType('ProcessingJob')
export class ProcessingJobType {
  @Field(() => ID, { description: 'Unique job identifier (UUID)' })
  id!: string;

  @Field(() => String, { description: 'Parent document ID (UUID)' })
  documentId!: string;

  @Field(() => ProcessingJobStatus, { description: 'Current job status' })
  status!: ProcessingJobStatus;

  @Field(() => Int, { description: 'Processing progress percentage (0–100)' })
  progress!: number;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Processing result metadata (JSON, only set on COMPLETED)',
  })
  result!: Record<string, unknown> | null;

  @Field(() => String, {
    nullable: true,
    description: 'Error message (only set on FAILED)',
  })
  errorMessage!: string | null;

  @Field(() => Date, {
    nullable: true,
    description: 'Timestamp when job started processing',
  })
  startedAt!: Date | null;

  @Field(() => Date, {
    nullable: true,
    description: 'Timestamp when job reached terminal state',
  })
  completedAt!: Date | null;

  @Field(() => Date, { description: 'Timestamp when job was created' })
  createdAt!: Date;

  @Field(() => Date, { description: 'Timestamp when job was last updated' })
  updatedAt!: Date;
}
