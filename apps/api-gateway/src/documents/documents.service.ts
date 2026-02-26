import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  Document,
  ProcessingJob,
  DocumentStatus,
  ProcessingJobStatus,
} from '@docflow/database';
import { StorageService } from '../storage/storage.service';
import { DocumentProcessingClient } from '../grpc/document-processing.client';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UploadDocumentResponseDto } from './dto/upload-document-response.dto';
import {
  ALLOWED_MIME_TYPES,
  FileTooLargeException,
  InvalidMimeTypeException,
  MissingFileException,
  DocumentCreationException,
  GrpcDispatchException,
} from './exceptions/document.exceptions';

/** Maximum allowed file size in bytes, derived from UPLOAD_MAX_FILE_SIZE_MB env var */
const BYTES_PER_MB = 1024 * 1024;

/**
 * DocumentsService — orchestrates the complete upload + job queue flow.
 *
 * Happy path:
 *   1. Validate file (presence, MIME type, size)
 *   2. Upload buffer to MinIO
 *   3. Transactionally persist Document + ProcessingJob to PostgreSQL
 *   4. Dispatch gRPC ProcessDocument call to the worker (non-fatal if fails)
 *   5. Return response DTO
 *
 * Failure invariants:
 *   - If MinIO upload fails → 502, no DB records created
 *   - If DB transaction fails → 500, MinIO object is orphaned (acceptable for portfolio;
 *     production would use a cleanup job or compensating transaction)
 *   - If gRPC dispatch fails → document & job exist in DB (pending), return 202
 *     so client knows processing is deferred; worker will pick it up on retry
 *
 * Dependencies injected:
 *   - DataSource: for explicit transaction management
 *   - StorageService: MinIO upload abstraction
 *   - DocumentProcessingClient: gRPC client wrapper
 *   - ConfigService: reads UPLOAD_MAX_FILE_SIZE_MB
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    private readonly grpcClient: DocumentProcessingClient,
    private readonly configService: ConfigService,
  ) {
    const maxFileSizeMb = this.configService.get<number>(
      'UPLOAD_MAX_FILE_SIZE_MB',
      50,
    );
    this.maxFileSizeBytes = maxFileSizeMb * BYTES_PER_MB;
  }

  /**
   * Handles a document upload request end-to-end.
   *
   * @param file      — Multer file from memoryStorage (buffer in RAM)
   * @param dto       — Validated form fields (optional title)
   * @param userId    — UUID of the authenticated user (from JWT)
   * @returns         — Response DTO with documentId, jobId, and metadata
   */
  async uploadDocument(
    file: Express.Multer.File | undefined,
    dto: UploadDocumentDto,
    userId: string,
  ): Promise<UploadDocumentResponseDto> {
    // ── Step 1: Validate file ──────────────────────────────
    this.validateFile(file);
    // After guard check, file is guaranteed non-null
    const validatedFile = file as Express.Multer.File;

    // ── Step 2: Upload to MinIO ────────────────────────────
    const fileUrl = await this.storageService.uploadFile(
      validatedFile.buffer,
      validatedFile.originalname,
      validatedFile.mimetype,
    );
    this.logger.log(
      `File uploaded to storage: ${fileUrl} (${validatedFile.size} bytes)`,
    );

    // ── Step 3: Persist Document + ProcessingJob atomically ─
    const title = dto.title?.trim() || validatedFile.originalname;

    const { document, job } = await this.createDocumentWithJob(
      userId,
      title,
      fileUrl,
      validatedFile.mimetype,
      validatedFile.size,
    );

    // ── Step 4: Dispatch gRPC call to worker ───────────────
    let grpcDispatchFailed = false;
    try {
      const grpcResponse = await this.grpcClient.processDocument({
        documentId: document.id,
        userId,
        filePath: fileUrl,
        mimeType: validatedFile.mimetype,
      });
      this.logger.log(
        `Worker accepted document ${document.id}, job ID: ${grpcResponse.jobId}`,
      );
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(
        `Worker gRPC dispatch failed for document ${document.id}: ${cause.message}. ` +
          `Document saved, processing deferred.`,
      );
      grpcDispatchFailed = true;
    }

    // ── Step 5: Build response ─────────────────────────────
    const response: UploadDocumentResponseDto = {
      documentId: document.id,
      jobId: job.id,
      status: job.status,
      title: document.title,
      fileUrl: document.fileUrl,
      fileSizeBytes: parseInt(document.fileSize, 10),
      mimeType: document.mimeType,
      createdAt: document.createdAt.toISOString(),
    };

    // Surface gRPC failure as an exception AFTER building the full response.
    // The document and job are already persisted — this is non-fatal but
    // the HTTP status code changes to 202 to signal deferred processing.
    if (grpcDispatchFailed) {
      const cause = new Error('Worker gRPC endpoint unreachable');
      throw new GrpcDispatchException(document.id, cause);
    }

    return response;
  }

  // ── Private methods ──────────────────────────────────────

  /**
   * Validates the uploaded file for presence, MIME type, and size.
   * Throws a typed HTTP exception on any validation failure.
   */
  private validateFile(file: Express.Multer.File | undefined): void {
    if (!file || !file.buffer || file.size === 0) {
      throw new MissingFileException();
    }

    const mimeIsAllowed = (ALLOWED_MIME_TYPES as readonly string[]).includes(
      file.mimetype,
    );
    if (!mimeIsAllowed) {
      throw new InvalidMimeTypeException(file.mimetype);
    }

    if (file.size > this.maxFileSizeBytes) {
      const maxMb = this.maxFileSizeBytes / BYTES_PER_MB;
      throw new FileTooLargeException(maxMb);
    }
  }

  /**
   * Creates a Document and ProcessingJob in a single database transaction.
   *
   * If either INSERT fails, the transaction is rolled back and no partial
   * records are left in the database.
   *
   * Uses DataSource.transaction() rather than the repository-level save()
   * to ensure both writes participate in the same transaction boundary.
   */
  private async createDocumentWithJob(
    userId: string,
    title: string,
    fileUrl: string,
    mimeType: string,
    fileSizeBytes: number,
  ): Promise<{ document: Document; job: ProcessingJob }> {
    this.logger.debug(
      `Starting transaction to create document and job for user ${userId}`,
    );

    try {
      return await this.dataSource.transaction(async (manager) => {
        // 1. Create document record
        const document = manager.create(Document, {
          title,
          fileUrl,
          mimeType,
          fileSize: fileSizeBytes.toString(), // bigint stored as string by pg driver
          status: DocumentStatus.UPLOADED,
          ownerId: userId,
          pageCount: null,
        });
        const savedDocument = await manager.save(Document, document);

        // 2. Create processing job record (linked to the new document)
        const job = manager.create(ProcessingJob, {
          documentId: savedDocument.id,
          status: ProcessingJobStatus.PENDING,
          progress: 0,
          result: null,
          errorMessage: null,
          startedAt: null,
          completedAt: null,
        });
        const savedJob = await manager.save(ProcessingJob, job);

        this.logger.log(
          `Transaction committed: document ${savedDocument.id}, job ${savedJob.id}`,
        );

        return { document: savedDocument, job: savedJob };
      });
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Transaction failed for user ${userId}: ${cause.message}`,
      );
      throw new DocumentCreationException(cause);
    }
  }
}
