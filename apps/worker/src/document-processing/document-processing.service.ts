import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, Subject } from 'rxjs';
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
import { RedisPublisherService, RedisSubscriberService } from '@docflow/redis';
import { ProgressEvent } from './interfaces/progress-event.interface';

// ── Processing simulation constants ───────────────────────
/** Simulated number of pages extracted per document */
const SIMULATED_PAGE_COUNT = 12;

/** Delay in milliseconds between processing each simulated page */
const PAGE_PROCESSING_DELAY_MS = 400;

/**
 * Redis channel key factory.
 * Follows the project naming convention: {domain}:{id}:{type}
 */
function progressChannel(jobId: string): string {
  return `doc:${jobId}:progress`;
}

/**
 * DocumentProcessingService — gRPC server implementation for document processing.
 *
 * Responsibilities:
 * 1. processDocument()   — Validate request, create DB records, kick-off background processing
 * 2. startProcessing()   — [fire-and-forget] Simulate page extraction, publish Redis events,
 *                         update DB progress and final status
 * 3. getProgress()       — Subscribe to Redis PubSub channel → Observable<ProgressUpdate>
 *
 * Architecture decision:
 *   processDocument() returns immediately with the jobId (fast gRPC response).
 *   startProcessing() runs asynchronously in the background — it reports progress
 *   via Redis PubSub so any number of consumers (SSE, gRPC streaming, WebSocket)
 *   can independently subscribe to the same channel without coupling to the worker.
 */
@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    @InjectRepository(ProcessingJob)
    private readonly jobRepository: Repository<ProcessingJob>,

    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,

    private readonly publisher: RedisPublisherService,
    private readonly subscriber: RedisSubscriberService,
  ) {}

  // ── Public gRPC-facing methods ───────────────────────────

  /**
   * Unary RPC: ProcessDocument
   *
   * 1. Validates that the document exists and belongs to the requesting user
   * 2. Guards against double-processing (existing RUNNING job → return early)
   * 3. Creates a ProcessingJob record with PENDING status
   * 4. Kicks off background processing (fire-and-forget)
   * 5. Returns the job ID immediately
   */
  async processDocument(
    request: ProcessDocumentRequest,
  ): Promise<ProcessDocumentResponse> {
    const { documentId, userId } = request;

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

    // Guard: return existing running job rather than spawning a duplicate
    const existingRunningJob = await this.jobRepository.findOne({
      where: { documentId, status: ProcessingJobStatus.RUNNING },
    });

    if (existingRunningJob) {
      this.logger.warn(
        `Document ${documentId} already has RUNNING job: ${existingRunningJob.id}`,
      );
      return {
        jobId: existingRunningJob.id,
        status: existingRunningJob.status,
        acceptedAt: this.toGrpcTimestamp(existingRunningJob.createdAt),
      };
    }

    // Create the processing job record
    try {
      const job = this.jobRepository.create({
        documentId,
        status: ProcessingJobStatus.PENDING,
        progress: 0,
      });
      const savedJob = await this.jobRepository.save(job);

      // Update document to PROCESSING so the UI can reflect it immediately
      await this.documentRepository.update(documentId, {
        status: DocumentStatus.PROCESSING,
      });

      this.logger.log(
        `Created processing job ${savedJob.id} for document ${documentId}`,
      );

      // Fire-and-forget: don't await — gRPC response is returned immediately
      this.startProcessing(savedJob.id, documentId).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Unhandled error in startProcessing for job ${savedJob.id}: ${message}`,
        );
      });

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
   * Server-streaming RPC: GetProgress
   *
   * Subscribes to the Redis PubSub channel for this job and converts
   * each ProgressEvent into a gRPC ProgressUpdate message.
   *
   * The stream completes when the job reaches a terminal state
   * (COMPLETED or FAILED) — the publisher sends the final event and
   * the subscriber closes the Subject.
   */
  getProgress(jobId: string): Observable<ProgressUpdate> {
    if (!jobId) {
      throw new GrpcInvalidArgumentException('job_id is required');
    }

    this.logger.log(`Opening progress stream for job ${jobId}`);

    const subject = new Subject<ProgressUpdate>();

    // Validate job exists before subscribing
    this.jobRepository
      .findOne({ where: { id: jobId } })
      .then((job) => {
        if (!job) {
          subject.error(
            new GrpcNotFoundException(`Processing job ${jobId} not found`),
          );
          return;
        }

        // If the job is already in a terminal state, emit a synthetic final
        // update immediately so callers don't wait forever on a dead channel
        if (
          job.status === ProcessingJobStatus.COMPLETED ||
          job.status === ProcessingJobStatus.FAILED
        ) {
          subject.next(this.jobToProgressUpdate(job));
          subject.complete();
          return;
        }

        // Subscribe to Redis channel for live progress events
        const channel = progressChannel(jobId);
        const redisSubscription = this.subscriber
          .subscribeJson<ProgressEvent>(channel)
          .subscribe({
            next: (event: ProgressEvent) => {
              subject.next(this.progressEventToUpdate(event));

              // Complete the stream on terminal events
              if (
                event.status === 'COMPLETED' ||
                event.status === 'FAILED'
              ) {
                subject.complete();
                redisSubscription.unsubscribe();
              }
            },
            error: (err: Error) => subject.error(err),
            complete: () => subject.complete(),
          });

        // Ensure Redis subscription is cleaned up if the subject errors
        subject.subscribe({
          error: () => redisSubscription.unsubscribe(),
        });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to open progress stream for job ${jobId}: ${message}`,
        );
        subject.error(
          new GrpcInternalException(
            `Failed to start progress stream: ${message}`,
          ),
        );
      });

    return subject.asObservable();
  }

  // ── Background processing pipeline ──────────────────────

  /**
   * startProcessing — fire-and-forget document processing simulation.
   *
   * Simulates page-by-page extraction with configurable delays.
   * Each page tick:
   *   1. Persists updated progress/status to PostgreSQL
   *   2. Publishes a ProgressEvent to Redis PubSub
   *
   * On success: marks job COMPLETED, document PROCESSED, publishes final event.
   * On failure: marks job FAILED with error message, publishes error event.
   *
   * Design note: DB writes happen BEFORE Redis publish so that any consumer
   * that reads the DB after receiving an event sees a consistent state.
   */
  private async startProcessing(
    jobId: string,
    documentId: string,
  ): Promise<void> {
    const channel = progressChannel(jobId);
    const totalPages = SIMULATED_PAGE_COUNT;

    this.logger.log(
      `Starting processing pipeline: job=${jobId}, document=${documentId}, pages=${totalPages}`,
    );

    try {
      // Transition job to RUNNING
      await this.jobRepository.update(jobId, {
        status: ProcessingJobStatus.RUNNING,
        progress: 0,
        startedAt: new Date(),
      });

      // Publish RUNNING start event
      await this.publishProgressEvent(channel, {
        jobId,
        documentId,
        status: 'RUNNING',
        progress: 0,
        message: `Processing started — ${totalPages} pages queued`,
        currentPage: 0,
        totalPages,
        publishedAt: new Date().toISOString(),
      });

      // ── Page-by-page simulation loop ─────────────────────
      for (let page = 1; page <= totalPages; page++) {
        await this.sleep(PAGE_PROCESSING_DELAY_MS);

        // progress: 0→100 distributed across pages, excluding 100 (reserved for completion)
        const progress = Math.round((page / totalPages) * 95);

        // Persist incremental progress to DB
        await this.jobRepository.update(jobId, {
          progress,
        });

        const event: ProgressEvent = {
          jobId,
          documentId,
          status: 'RUNNING',
          progress,
          message: `Processing page ${page} of ${totalPages}`,
          currentPage: page,
          totalPages,
          publishedAt: new Date().toISOString(),
        };

        await this.publishProgressEvent(channel, event);

        this.logger.debug(
          `Job ${jobId}: page ${page}/${totalPages} — ${progress}%`,
        );
      }

      // ── Completion ───────────────────────────────────────
      const completedAt = new Date();

      await this.jobRepository.update(jobId, {
        status: ProcessingJobStatus.COMPLETED,
        progress: 100,
        completedAt,
      });

      await this.documentRepository.update(documentId, {
        status: DocumentStatus.COMPLETED,
        pageCount: totalPages,
      });

      const completionEvent: ProgressEvent = {
        jobId,
        documentId,
        status: 'COMPLETED',
        progress: 100,
        message: `Processing complete — ${totalPages} pages extracted`,
        currentPage: totalPages,
        totalPages,
        publishedAt: completedAt.toISOString(),
      };

      await this.publishProgressEvent(channel, completionEvent);

      this.logger.log(
        `Job ${jobId} completed successfully (${totalPages} pages)`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown processing error';

      this.logger.error(
        `Job ${jobId} failed during processing: ${errorMessage}`,
      );

      // Persist failure state
      await this.jobRepository
        .update(jobId, {
          status: ProcessingJobStatus.FAILED,
          errorMessage,
          completedAt: new Date(),
        })
        .catch((dbErr: unknown) => {
          const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
          this.logger.error(
            `CRITICAL: failed to persist FAILED status for job ${jobId}: ${msg}`,
          );
        });

      // Publish failure event so consumers can stop waiting
      await this.publishProgressEvent(channel, {
        jobId,
        documentId,
        status: 'FAILED',
        progress: 0,
        message: 'Processing failed',
        currentPage: 0,
        totalPages,
        errorMessage,
        publishedAt: new Date().toISOString(),
      }).catch(() => {
        /* Swallow: already in error path, Redis publish is best-effort */
      });
    }
  }

  // ── Utility methods ──────────────────────────────────────

  private async publishProgressEvent(
    channel: string,
    event: ProgressEvent,
  ): Promise<void> {
    try {
      await this.publisher.publish(channel, event);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Non-fatal: log and continue — DB is the source of truth;
      // Redis publish is best-effort for real-time consumers
      this.logger.warn(
        `Failed to publish progress event to channel "${channel}": ${message}`,
      );
    }
  }

  private jobToProgressUpdate(job: ProcessingJob): ProgressUpdate {
    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      errorMessage: job.errorMessage ?? '',
      updatedAt: this.toGrpcTimestamp(job.completedAt ?? job.updatedAt),
    };
  }

  private progressEventToUpdate(event: ProgressEvent): ProgressUpdate {
    return {
      jobId: event.jobId,
      status: event.status,
      progress: event.progress,
      errorMessage: event.errorMessage ?? '',
      updatedAt: this.toGrpcTimestamp(new Date(event.publishedAt)),
    };
  }

  private toGrpcTimestamp(date: Date): GrpcTimestamp {
    const ms = date.getTime();
    return {
      seconds: Math.floor(ms / 1000),
      nanos: (ms % 1000) * 1_000_000,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
