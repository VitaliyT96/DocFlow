import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { ProcessingJob } from './processing-job.entity';
import { Annotation } from './annotation.entity';
import { DocumentStatus } from '../enums/document-status.enum';

/**
 * Document entity — represents an uploaded file in the processing pipeline.
 *
 * Invariants:
 * - Every document belongs to exactly one user (owner)
 * - Status transitions follow: UPLOADED → PROCESSING → COMPLETED | FAILED
 * - page_count is set only after successful processing
 * - file_url points to the storage location (S3 path or local path)
 * - Deleting a document cascades to all processing jobs and annotations
 */
@Entity('documents')
@Index('IDX_documents_owner_status', ['ownerId', 'status'])
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'varchar', length: 1024, name: 'file_url' })
  fileUrl!: string;

  @Column({ type: 'varchar', length: 128, name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'bigint', name: 'file_size' })
  fileSize!: string; // bigint stored as string by pg driver

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.UPLOADED,
  })
  status!: DocumentStatus;

  @Column({ type: 'int', name: 'page_count', nullable: true })
  pageCount!: number | null;

  @Index('IDX_documents_owner_id')
  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  // ── Relations ────────────────────────────────────────────

  @ManyToOne(() => User, (user) => user.documents, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @OneToMany(() => ProcessingJob, (job) => job.document, { cascade: false })
  processingJobs!: ProcessingJob[];

  @OneToMany(() => Annotation, (annotation) => annotation.document, {
    cascade: false,
  })
  annotations!: Annotation[];
}
