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
import { User } from './user.entity';
import { AnnotationType } from '../enums/annotation-type.enum';

/**
 * Annotation entity — a user-created annotation on a document page.
 *
 * Invariants:
 * - Each annotation belongs to exactly one document and one user
 * - Position (x, y) is relative to the page coordinate system (0.0–1.0 normalized)
 * - page_number is 1-indexed
 * - Annotations are synchronized in real-time via WebSocket gateway
 * - Deleting a document cascades to all its annotations
 */
@Entity('annotations')
@Index('IDX_annotations_document_page', ['documentId', 'pageNumber'])
export class Annotation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_annotations_document_id')
  @Column({ type: 'uuid', name: 'document_id' })
  documentId!: string;

  @Index('IDX_annotations_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({
    type: 'enum',
    enum: AnnotationType,
  })
  type!: AnnotationType;

  @Column({ type: 'int', name: 'page_number' })
  pageNumber!: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'x_position' })
  xPosition!: string; // decimal stored as string by pg driver

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'y_position' })
  yPosition!: string; // decimal stored as string by pg driver

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  // ── Relations ────────────────────────────────────────────

  @ManyToOne(() => Document, (document) => document.annotations, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'document_id' })
  document!: Document;

  @ManyToOne(() => User, (user) => user.annotations, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
