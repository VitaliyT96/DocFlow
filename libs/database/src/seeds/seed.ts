import { Logger } from '@nestjs/common';
import AppDataSource from '../data-source';
import { User } from '../entities/user.entity';
import { Document } from '../entities/document.entity';
import { ProcessingJob } from '../entities/processing-job.entity';
import { Annotation } from '../entities/annotation.entity';
import { DocumentStatus } from '../enums/document-status.enum';
import { ProcessingJobStatus } from '../enums/processing-job-status.enum';
import { AnnotationType } from '../enums/annotation-type.enum';

/**
 * Seed script — populates the database with realistic demo data.
 *
 * Usage:
 *   pnpm --filter @docflow/database seed
 *   # or from project root:
 *   pnpm run seed
 *
 * Prerequisites:
 *   - PostgreSQL is running (docker compose up -d postgres)
 *   - Migrations have been applied (pnpm run migration:run)
 *
 * This script is idempotent: it truncates all tables before inserting.
 */

/**
 * Pre-hashed passwords for demo users.
 * All passwords are "password123" hashed with bcrypt (10 rounds).
 */
const DEMO_PASSWORD_HASH =
  '$2b$10$K4GHqbPA0t45cqMq1WRHQuNLOIxDBVLweMFqBBqNMPCfVcy8AGH6a';

interface SeedUser {
  email: string;
  fullName: string;
  passwordHash: string;
  isActive: boolean;
}

interface SeedDocument {
  title: string;
  fileUrl: string;
  mimeType: string;
  fileSize: string;
  status: DocumentStatus;
  pageCount: number | null;
}

interface SeedJob {
  status: ProcessingJobStatus;
  progress: number;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

interface SeedAnnotation {
  type: AnnotationType;
  pageNumber: number;
  xPosition: string;
  yPosition: string;
  content: string;
  color: string | null;
}

const USERS: SeedUser[] = [
  {
    email: 'alice@docflow.dev',
    fullName: 'Alice Johnson',
    passwordHash: DEMO_PASSWORD_HASH,
    isActive: true,
  },
  {
    email: 'bob@docflow.dev',
    fullName: 'Bob Smith',
    passwordHash: DEMO_PASSWORD_HASH,
    isActive: true,
  },
  {
    email: 'charlie@docflow.dev',
    fullName: 'Charlie Brown',
    passwordHash: DEMO_PASSWORD_HASH,
    isActive: false,
  },
];

const DOCUMENTS: SeedDocument[] = [
  {
    title: 'Q4 Financial Report 2025.pdf',
    fileUrl: '/uploads/docs/q4-financial-report-2025.pdf',
    mimeType: 'application/pdf',
    fileSize: '2458624',
    status: DocumentStatus.COMPLETED,
    pageCount: 24,
  },
  {
    title: 'Engineering Design Spec v3.pdf',
    fileUrl: '/uploads/docs/engineering-design-spec-v3.pdf',
    mimeType: 'application/pdf',
    fileSize: '5242880',
    status: DocumentStatus.COMPLETED,
    pageCount: 67,
  },
  {
    title: 'Marketing Strategy Draft.docx',
    fileUrl: '/uploads/docs/marketing-strategy-draft.docx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: '1048576',
    status: DocumentStatus.PROCESSING,
    pageCount: null,
  },
  {
    title: 'Board Meeting Minutes.pdf',
    fileUrl: '/uploads/docs/board-meeting-minutes.pdf',
    mimeType: 'application/pdf',
    fileSize: '524288',
    status: DocumentStatus.FAILED,
    pageCount: null,
  },
  {
    title: 'Product Roadmap 2026.pdf',
    fileUrl: '/uploads/docs/product-roadmap-2026.pdf',
    mimeType: 'application/pdf',
    fileSize: '3145728',
    status: DocumentStatus.UPLOADED,
    pageCount: null,
  },
  {
    title: 'API Documentation v2.1.pdf',
    fileUrl: '/uploads/docs/api-documentation-v2.1.pdf',
    mimeType: 'application/pdf',
    fileSize: '1572864',
    status: DocumentStatus.COMPLETED,
    pageCount: 45,
  },
];

/** Maps document index → processing job data */
const JOBS: Record<number, SeedJob> = {
  0: {
    status: ProcessingJobStatus.COMPLETED,
    progress: 100,
    result: { textExtracted: true, ocrApplied: false, thumbnailGenerated: true },
    errorMessage: null,
    startedAt: new Date('2025-12-10T10:30:00Z'),
    completedAt: new Date('2025-12-10T10:31:45Z'),
  },
  1: {
    status: ProcessingJobStatus.COMPLETED,
    progress: 100,
    result: { textExtracted: true, ocrApplied: true, thumbnailGenerated: true },
    errorMessage: null,
    startedAt: new Date('2025-12-15T14:00:00Z'),
    completedAt: new Date('2025-12-15T14:05:20Z'),
  },
  2: {
    status: ProcessingJobStatus.RUNNING,
    progress: 42,
    result: null,
    errorMessage: null,
    startedAt: new Date('2026-01-20T09:00:00Z'),
    completedAt: null,
  },
  3: {
    status: ProcessingJobStatus.FAILED,
    progress: 15,
    result: null,
    errorMessage:
      'Unsupported encryption: document is password-protected (AES-256)',
    startedAt: new Date('2026-01-18T16:00:00Z'),
    completedAt: new Date('2026-01-18T16:00:30Z'),
  },
  5: {
    status: ProcessingJobStatus.COMPLETED,
    progress: 100,
    result: { textExtracted: true, ocrApplied: false, thumbnailGenerated: true },
    errorMessage: null,
    startedAt: new Date('2026-02-01T11:00:00Z'),
    completedAt: new Date('2026-02-01T11:03:10Z'),
  },
};

/** Maps document index → array of annotations (only for completed docs) */
const ANNOTATIONS: Record<number, SeedAnnotation[]> = {
  0: [
    {
      type: AnnotationType.HIGHLIGHT,
      pageNumber: 3,
      xPosition: '0.1200',
      yPosition: '0.3400',
      content: 'Revenue exceeded projections by 12%',
      color: '#FFEB3B',
    },
    {
      type: AnnotationType.COMMENT,
      pageNumber: 7,
      xPosition: '0.5500',
      yPosition: '0.7800',
      content: 'Need to verify these expense figures with accounting',
      color: null,
    },
  ],
  1: [
    {
      type: AnnotationType.BOOKMARK,
      pageNumber: 1,
      xPosition: '0.0000',
      yPosition: '0.0000',
      content: 'Architecture overview',
      color: '#2196F3',
    },
    {
      type: AnnotationType.HIGHLIGHT,
      pageNumber: 15,
      xPosition: '0.2000',
      yPosition: '0.4500',
      content: 'Critical path for the data pipeline',
      color: '#FF5722',
    },
    {
      type: AnnotationType.COMMENT,
      pageNumber: 42,
      xPosition: '0.6000',
      yPosition: '0.2500',
      content: 'This section needs review from the security team',
      color: null,
    },
  ],
  5: [
    {
      type: AnnotationType.BOOKMARK,
      pageNumber: 1,
      xPosition: '0.0000',
      yPosition: '0.0000',
      content: 'Authentication endpoints',
      color: '#4CAF50',
    },
  ],
};

async function seed(): Promise<void> {
  const logger = new Logger('Seed');

  logger.log('Initializing data source...');
  await AppDataSource.initialize();

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    logger.log('Truncating tables...');
    // Truncate in correct FK order (children first, then parents)
    await queryRunner.query(
      'TRUNCATE TABLE annotations, processing_jobs, documents, users CASCADE',
    );

    // ── Insert Users ───────────────────────────────────────
    const userRepo = queryRunner.manager.getRepository(User);
    const savedUsers = await userRepo.save(
      USERS.map((u) => userRepo.create(u)),
    );
    logger.log(`✓ Inserted ${savedUsers.length} users`);

    // ── Insert Documents ───────────────────────────────────
    const docRepo = queryRunner.manager.getRepository(Document);
    const savedDocs: Document[] = [];
    for (let i = 0; i < DOCUMENTS.length; i++) {
      const docData = DOCUMENTS[i];
      // Distribute documents across users (round-robin)
      const owner = savedUsers[i % savedUsers.length];
      const doc = docRepo.create({
        ...docData,
        ownerId: owner.id,
      });
      savedDocs.push(await docRepo.save(doc));
    }
    logger.log(`✓ Inserted ${savedDocs.length} documents`);

    // ── Insert Processing Jobs ─────────────────────────────
    const jobRepo = queryRunner.manager.getRepository(ProcessingJob);
    let jobCount = 0;
    for (const [docIndexStr, jobData] of Object.entries(JOBS)) {
      const docIndex = parseInt(docIndexStr, 10);
      const doc = savedDocs[docIndex];
      const job = jobRepo.create({
        ...jobData,
        documentId: doc.id,
      });
      await jobRepo.save(job);
      jobCount++;
    }
    logger.log(`✓ Inserted ${jobCount} processing jobs`);

    // ── Insert Annotations ─────────────────────────────────
    const annotationRepo = queryRunner.manager.getRepository(Annotation);
    let annotationCount = 0;
    for (const [docIndexStr, annotations] of Object.entries(ANNOTATIONS)) {
      const docIndex = parseInt(docIndexStr, 10);
      const doc = savedDocs[docIndex];
      // Use a different user than the owner for some annotations (collaboration)
      const annotatorIndex = (docIndex + 1) % savedUsers.length;
      const annotator = savedUsers[annotatorIndex];

      for (const annotationData of annotations) {
        const annotation = annotationRepo.create({
          ...annotationData,
          documentId: doc.id,
          userId: annotator.id,
        });
        await annotationRepo.save(annotation);
        annotationCount++;
      }
    }
    logger.log(`✓ Inserted ${annotationCount} annotations`);

    await queryRunner.commitTransaction();
    logger.log('─────────────────────────────────────────');
    logger.log('✅ Seed completed successfully!');
    logger.log(`   Users:          ${savedUsers.length}`);
    logger.log(`   Documents:      ${savedDocs.length}`);
    logger.log(`   Processing Jobs: ${jobCount}`);
    logger.log(`   Annotations:    ${annotationCount}`);
  } catch (error) {
    logger.error('Seed failed, rolling back transaction...');
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

seed().catch((error: Error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal seed error:', error.message);
  process.exit(1);
});
