import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Document } from './document.entity';
import { ProcessingJobStatus } from '../enums/processing-job-status.enum';

/**
 * ProcessingJob entity — tracks a single worker processing attempt.
 *
 * Invariants:
 * - Each job belongs to exactly one document
 * - A document may have multiple jobs (retries), but only one should be RUNNING
 * - Terminal states: COMPLETED or FAILED
 * - started_at is set when status transitions to RUNNING
 * - completed_at is set when status transitions to COMPLETED or FAILED
 * - progress is 0–100 (percentage), published via Redis PubSub for SSE streaming
 * - result is a JSON object with processing output metadata (only on COMPLETED)
 * - error_message is set only on FAILED
 */
@Entity('processing_jobs')
@Index('IDX_processing_jobs_document_status', ['documentId', 'status'])
export class ProcessingJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_processing_jobs_document_id')
  @Column({ type: 'uuid', name: 'document_id' })
  documentId!: string;

  @Column({
    type: 'enum',
    enum: ProcessingJobStatus,
    default: ProcessingJobStatus.PENDING,
  })
  status!: ProcessingJobStatus;

  @Column({ type: 'smallint', default: 0 })
  progress!: number;

  @Column({ type: 'jsonb', nullable: true })
  result!: Record<string, unknown> | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  // ── Relations ────────────────────────────────────────────

  @ManyToOne(() => Document, (document) => document.processingJobs, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'document_id' })
  document!: Document;
}
