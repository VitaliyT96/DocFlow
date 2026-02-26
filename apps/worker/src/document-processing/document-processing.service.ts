import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, Subject, interval, takeWhile, map, finalize } from 'rxjs';
import {
  Document,
  ProcessingJob,
  ProcessingJobStatus,
  DocumentStatus,
} from '@docflow/database';
import {
  ProcessDocumentRequest,
  ProcessDocumentResponse,
  ProgressUpdate,
  GrpcTimestamp,
  GrpcNotFoundException,
  GrpcInvalidArgumentException,
  GrpcInternalException,
} from '@docflow/proto';

/**
 * Business logic for document processing via gRPC.
 *
 * Responsibilities:
 * - Validate incoming processing requests
 * - Create ProcessingJob records in the database
 * - Provide progress streams (simulated for now; will be replaced
 *   by Redis PubSub subscription in the SSE task)
 */
@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    @InjectRepository(ProcessingJob)
    private readonly jobRepository: Repository<ProcessingJob>,

    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  /**
   * Initiates document processing.
   *
   * 1. Validates that the document exists and belongs to the requesting user
   * 2. Creates a ProcessingJob record with PENDING status
   * 3. Returns the job ID for progress tracking
   */
  async processDocument(
    request: ProcessDocumentRequest,
  ): Promise<ProcessDocumentResponse> {
    const { documentId, userId, filePath, mimeType } = request;

    // ── Validate document exists and belongs to user ────
    if (!documentId || !userId) {
      throw new GrpcInvalidArgumentException(
        'document_id and user_id are required',
      );
    }

    const document = await this.documentRepository.findOne({
      where: { id: documentId, ownerId: userId },
    });

    if (!document) {
      throw new GrpcNotFoundException(
        `Document ${documentId} not found or not owned by user ${userId}`,
      );
    }

    // ── Check for already running jobs ──────────────────
    const existingRunningJob = await this.jobRepository.findOne({
      where: {
        documentId,
        status: ProcessingJobStatus.RUNNING,
      },
    });

    if (existingRunningJob) {
      this.logger.warn(
        `Document ${documentId} already has a running job: ${existingRunningJob.id}`,
      );
      return {
        jobId: existingRunningJob.id,
        status: existingRunningJob.status,
        acceptedAt: this.toGrpcTimestamp(existingRunningJob.createdAt),
      };
    }

    // ── Create processing job ───────────────────────────
    try {
      const job = this.jobRepository.create({
        documentId,
        status: ProcessingJobStatus.PENDING,
        progress: 0,
      });
      const savedJob = await this.jobRepository.save(job);

      // Update document status to PROCESSING
      await this.documentRepository.update(documentId, {
        status: DocumentStatus.PROCESSING,
      });

      this.logger.log(
        `Created processing job ${savedJob.id} for document ${documentId}`,
      );

      return {
        jobId: savedJob.id,
        status: savedJob.status,
        acceptedAt: this.toGrpcTimestamp(savedJob.createdAt),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to create processing job for document ${documentId}: ${errorMessage}`,
      );
      throw new GrpcInternalException(
        `Failed to create processing job: ${errorMessage}`,
      );
    }
  }

  /**
   * Returns an Observable that streams progress updates for a given job.
   *
   * Current implementation: simulates progress from 0→100 in 10% increments.
   * Future implementation: subscribes to Redis PubSub channel `doc:{jobId}:progress`
   * and relays real events from the actual processing pipeline.
   */
  getProgress(jobId: string): Observable<ProgressUpdate> {
    if (!jobId) {
      throw new GrpcInvalidArgumentException('job_id is required');
    }

    this.logger.log(`Starting progress stream for job ${jobId}`);

    const subject = new Subject<ProgressUpdate>();

    // Validate job exists, then start streaming
    this.jobRepository
      .findOne({ where: { id: jobId } })
      .then((job) => {
        if (!job) {
          subject.error(
            new GrpcNotFoundException(
              `Processing job ${jobId} not found`,
            ),
          );
          return;
        }

        // ── Simulated progress stream ─────────────────
        // Emits incremental progress every 500ms
        // Will be replaced by Redis PubSub in the SSE task
        let currentProgress = 0;
        const PROGRESS_INCREMENT = 10;
        const PROGRESS_INTERVAL_MS = 500;

        const progressInterval = setInterval(() => {
          currentProgress = Math.min(
            currentProgress + PROGRESS_INCREMENT,
            100,
          );

          const isComplete = currentProgress >= 100;
          const status = isComplete
            ? ProcessingJobStatus.COMPLETED
            : ProcessingJobStatus.RUNNING;

          const update: ProgressUpdate = {
            jobId,
            status,
            progress: currentProgress,
            errorMessage: '',
            updatedAt: this.toGrpcTimestamp(new Date()),
          };

          subject.next(update);

          if (isComplete) {
            this.logger.log(
              `Progress stream complete for job ${jobId}`,
            );
            clearInterval(progressInterval);
            subject.complete();
          }
        }, PROGRESS_INTERVAL_MS);

        // Cleanup on unsubscribe
        subject.subscribe({
          error: () => clearInterval(progressInterval),
          complete: () => clearInterval(progressInterval),
        });
      })
      .catch((error) => {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to start progress stream for job ${jobId}: ${errorMessage}`,
        );
        subject.error(
          new GrpcInternalException(
            `Failed to start progress stream: ${errorMessage}`,
          ),
        );
      });

    return subject.asObservable();
  }

  // ── Utility ─────────────────────────────────────────────

  private toGrpcTimestamp(date: Date): GrpcTimestamp {
    const ms = date.getTime();
    return {
      seconds: Math.floor(ms / 1000),
      nanos: (ms % 1000) * 1_000_000,
    };
  }
}
