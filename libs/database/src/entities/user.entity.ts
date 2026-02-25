import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Document } from './document.entity';
import { Annotation } from './annotation.entity';

/**
 * User entity — represents an authenticated user of the platform.
 *
 * Invariants:
 * - Email must be unique across all users
 * - Password is stored as a bcrypt hash, never in plaintext
 * - Deleting a user cascades to all their documents and annotations
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_users_email', { unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName!: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  // ── Relations ────────────────────────────────────────────

  @OneToMany(() => Document, (document) => document.owner, { cascade: false })
  documents!: Document[];

  @OneToMany(() => Annotation, (annotation) => annotation.user, {
    cascade: false,
  })
  annotations!: Annotation[];
}
