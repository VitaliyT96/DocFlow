import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema migration — creates all core tables for DocFlow.
 *
 * Tables: users, documents, processing_jobs, annotations
 * Enums: document_status_enum, processing_job_status_enum, annotation_type_enum
 *
 * This migration is hand-written to match the TypeORM entity definitions exactly,
 * since migration:generate requires a running database connection. The SQL is
 * PostgreSQL-specific (uuid_generate_v4, timestamptz, jsonb, CREATE TYPE).
 */
export class InitialSchema1740510000000 implements MigrationInterface {
  name = 'InitialSchema1740510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enable UUID extension ──────────────────────────────
    await queryRunner.query(
      `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,
    );

    // ── Create enum types ──────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "document_status_enum" AS ENUM ('uploaded', 'processing', 'completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "processing_job_status_enum" AS ENUM ('pending', 'running', 'completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "annotation_type_enum" AS ENUM ('highlight', 'comment', 'bookmark')`,
    );

    // ── Users table ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email"         varchar(255) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "full_name"     varchar(255) NOT NULL,
        "is_active"     boolean NOT NULL DEFAULT true,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email")`,
    );

    // ── Documents table ────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title"       varchar(500) NOT NULL,
        "file_url"    varchar(1024) NOT NULL,
        "mime_type"   varchar(128) NOT NULL,
        "file_size"   bigint NOT NULL,
        "status"      "document_status_enum" NOT NULL DEFAULT 'uploaded',
        "page_count"  integer,
        "owner_id"    uuid NOT NULL,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_documents_owner" FOREIGN KEY ("owner_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_documents_owner_id" ON "documents" ("owner_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_owner_status" ON "documents" ("owner_id", "status")`,
    );

    // ── Processing Jobs table ──────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "processing_jobs" (
        "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_id"   uuid NOT NULL,
        "status"        "processing_job_status_enum" NOT NULL DEFAULT 'pending',
        "progress"      smallint NOT NULL DEFAULT 0,
        "result"        jsonb,
        "error_message" text,
        "started_at"    TIMESTAMPTZ,
        "completed_at"  TIMESTAMPTZ,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_processing_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_processing_jobs_document" FOREIGN KEY ("document_id")
          REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_processing_jobs_document_id" ON "processing_jobs" ("document_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_processing_jobs_document_status" ON "processing_jobs" ("document_id", "status")`,
    );

    // ── Annotations table ──────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "annotations" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "user_id"     uuid NOT NULL,
        "type"        "annotation_type_enum" NOT NULL,
        "page_number" integer NOT NULL,
        "x_position"  numeric(10,4) NOT NULL,
        "y_position"  numeric(10,4) NOT NULL,
        "content"     text NOT NULL,
        "color"       varchar(7),
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_annotations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_annotations_document" FOREIGN KEY ("document_id")
          REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_annotations_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_annotations_document_id" ON "annotations" ("document_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_annotations_user_id" ON "annotations" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_annotations_document_page" ON "annotations" ("document_id", "page_number")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Drop tables (reverse order of creation) ────────────
    await queryRunner.query(`DROP TABLE IF EXISTS "annotations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "processing_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    // ── Drop enum types ────────────────────────────────────
    await queryRunner.query(`DROP TYPE IF EXISTS "annotation_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "processing_job_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "document_status_enum"`);

    // ── Drop extension ─────────────────────────────────────
    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
  }
}
