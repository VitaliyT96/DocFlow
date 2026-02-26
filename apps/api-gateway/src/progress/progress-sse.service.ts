import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { Subscription } from 'rxjs';
import { ProcessingJob, ProcessingJobStatus } from '@docflow/database';
import { RedisSubscriberService } from '@docflow/redis';
import {
  ProgressEvent,
  SseProgressPayload,
} from './interfaces/progress-event.interface';

/** Channel key factory — must match the worker's publisher */
function progressChannel(jobId: string): string {
  return `doc:${jobId}:progress`;
}

// ── Timing constants ────────────────────────────────────────

/**
 * SSE keepalive interval (ms).
 * Proxies/LBs (nginx, ALB, Cloudflare) drop idle connections after 60 s.
 * 25 s keeps us well under the most aggressive timeout.
 */
const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * Maximum SSE stream lifetime (ms).
 * Prevents resource leaks if the worker crashes and never sends a terminal event.
 * 5 minutes is generous for any realistic document processing run.
 */
const MAX_STREAM_LIFETIME_MS = 5 * 60 * 1000;

/**
 * Retry directive sent in the first SSE frame (ms).
 * Tells the browser's EventSource to reconnect after this delay upon disconnect.
 */
const SSE_RETRY_MS = 3_000;

/**
 * StreamContext — all mutable state for a single SSE connection.
 *
 * Centralised here so that cleanup() can tear everything down
 * deterministically without risk of double-release.
 */
interface StreamContext {
  readonly jobId: string;
  readonly res: Response;
  eventCounter: number;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
  redisSubscription: Subscription | null;
  closed: boolean;
}

/**
 * ProgressSseService — bridges Redis PubSub to HTTP Server-Sent Events.
 *
 * Lifecycle of a single SSE stream:
 *
 * 1. **Validate** — Query PostgreSQL for the job. 404 if absent.
 * 2. **Initial snapshot** — If the job has already progressed, emit its
 *    current DB state as the first SSE frame so the client isn't blank.
 *    If terminal, close immediately after.
 * 3. **Subscribe** — Open a Redis PubSub subscription on `doc:{jobId}:progress`.
 *    Each published ProgressEvent is mapped to SseProgressPayload and
 *    written as an SSE data frame with `id:` and `event:` fields.
 * 4. **Heartbeat** — A `: heartbeat\n\n` SSE comment fires every 25 s to
 *    keep the TCP connection alive through reverse proxies.
 * 5. **Timeout** — After 5 minutes the stream is force-closed to prevent
 *    resource leaks (e.g., worker crashed, no terminal event).
 * 6. **Cleanup** — Triggered by terminal event, client disconnect, or timeout.
 *    All timers and subscriptions are released exactly once.
 */
@Injectable()
export class ProgressSseService {
  private readonly logger = new Logger(ProgressSseService.name);

  constructor(
    @InjectRepository(ProcessingJob)
    private readonly jobRepository: Repository<ProcessingJob>,

    private readonly subscriber: RedisSubscriberService,
  ) {}

  // ── Public API ──────────────────────────────────────────

  /**
   * Opens an SSE stream for the given job.
   *
   * @returns `true` if the stream was opened, `false` if a 404 was sent.
   *          The caller should not touch `res` after this method returns.
   */
  async streamProgress(jobId: string, res: Response): Promise<boolean> {
    // ── 1. Validate job existence ─────────────────────────
    const job = await this.findJob(jobId);

    if (!job) {
      this.logger.warn(`SSE rejected: job ${jobId} not found`);
      res.status(404).json({
        statusCode: 404,
        message: `Processing job ${jobId} not found`,
        error: 'Not Found',
      });
      return false;
    }

    this.logger.log(`SSE stream opened for job ${jobId} (status: ${job.status})`);

    // ── 2. Build stream context ───────────────────────────
    const ctx: StreamContext = {
      jobId,
      res,
      eventCounter: 0,
      heartbeatTimer: null,
      timeoutTimer: null,
      redisSubscription: null,
      closed: false,
    };

    // ── 3. Send retry directive ───────────────────────────
    res.write(`retry: ${SSE_RETRY_MS}\n\n`);

    // ── 4. Deliver initial snapshot from DB ────────────────
    const initialPayload = this.jobToPayload(job);
    this.writeSseFrame(ctx, 'progress', initialPayload);

    // If the job is already terminal, close immediately
    if (this.isTerminal(job.status)) {
      this.logger.log(
        `Job ${jobId} already in terminal state (${job.status}). Closing SSE after snapshot.`,
      );
      res.end();
      return true;
    }

    // ── 5. Start heartbeat timer ──────────────────────────
    ctx.heartbeatTimer = setInterval(() => {
      this.writeHeartbeat(ctx);
    }, HEARTBEAT_INTERVAL_MS);

    // ── 6. Start timeout timer ────────────────────────────
    ctx.timeoutTimer = setTimeout(() => {
      this.logger.warn(`SSE stream for job ${jobId} reached max lifetime. Force-closing.`);
      this.writeSseFrame(ctx, 'timeout', {
        jobId,
        message: 'Stream timed out — please reconnect or check job status via API',
      });
      this.cleanup(ctx);
    }, MAX_STREAM_LIFETIME_MS);

    // ── 7. Subscribe to Redis PubSub ──────────────────────
    const channel = progressChannel(jobId);

    ctx.redisSubscription = this.subscriber
      .subscribeJson<ProgressEvent>(channel)
      .subscribe({
        next: (event: ProgressEvent) => {
          const payload = this.eventToPayload(event);
          this.writeSseFrame(ctx, 'progress', payload);

          if (event.status === 'COMPLETED' || event.status === 'FAILED') {
            this.logger.log(
              `Job ${jobId} reached terminal state: ${event.status}. Closing SSE.`,
            );
            this.cleanup(ctx);
          }
        },
        error: (err: Error) => {
          this.logger.error(
            `Redis subscription error for job ${jobId}: ${err.message}`,
          );

          this.writeSseFrame(ctx, 'error', {
            jobId,
            stage: 'FAILED',
            percent: 0,
            message: 'Stream error — please retry',
            errorMessage: err.message,
            timestamp: new Date().toISOString(),
          });
          this.cleanup(ctx);
        },
        complete: () => {
          this.logger.debug(`Redis subscription completed for job ${jobId}`);
          this.cleanup(ctx);
        },
      });

    // ── 8. Cleanup on client disconnect ───────────────────
    res.on('close', () => {
      this.logger.log(`Client disconnected from SSE stream for job ${jobId}`);
      this.cleanup(ctx);
    });

    return true;
  }

  // ── Private helpers ──────────────────────────────────────

  /**
   * Writes a spec-compliant SSE frame with `id:`, `event:`, and `data:` fields.
   *
   * Wire format:
   *   id: <counter>\n
   *   event: <eventName>\n
   *   data: <json>\n
   *   \n
   */
  private writeSseFrame(ctx: StreamContext, eventName: string, payload: object): void {
    if (ctx.closed) return;

    try {
      const id = ++ctx.eventCounter;
      const data = JSON.stringify(payload);
      ctx.res.write(`id: ${id}\nevent: ${eventName}\ndata: ${data}\n\n`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to write SSE frame for job ${ctx.jobId}: ${message}`);
    }
  }

  /**
   * Writes an SSE comment (`:`) as a keepalive.
   * Comments are ignored by EventSource but keep the TCP connection alive.
   */
  private writeHeartbeat(ctx: StreamContext): void {
    if (ctx.closed) return;

    try {
      ctx.res.write(`: heartbeat\n\n`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to write heartbeat for job ${ctx.jobId}: ${message}`);
    }
  }

  /**
   * Deterministic cleanup: clears timers, unsubscribes Redis, ends HTTP response.
   * Safe to call multiple times — the `closed` flag prevents double-release.
   */
  private cleanup(ctx: StreamContext): void {
    if (ctx.closed) return;
    ctx.closed = true;

    if (ctx.heartbeatTimer) {
      clearInterval(ctx.heartbeatTimer);
      ctx.heartbeatTimer = null;
    }
    if (ctx.timeoutTimer) {
      clearTimeout(ctx.timeoutTimer);
      ctx.timeoutTimer = null;
    }
    if (ctx.redisSubscription) {
      ctx.redisSubscription.unsubscribe();
      ctx.redisSubscription = null;
    }

    try {
      ctx.res.end();
    } catch {
      // Response may already be closed by the other side — ignore
    }
  }

  /**
   * Converts a Redis ProgressEvent to the client-facing SseProgressPayload.
   */
  private eventToPayload(event: ProgressEvent): SseProgressPayload {
    return {
      jobId: event.jobId,
      documentId: event.documentId,
      percent: event.progress,
      stage: event.status,
      message: event.message,
      currentPage: event.currentPage,
      totalPages: event.totalPages,
      errorMessage: event.errorMessage,
      timestamp: event.publishedAt,
    };
  }

  /**
   * Converts a ProcessingJob DB entity to the client-facing SseProgressPayload.
   * Used for the initial snapshot when the client first connects.
   */
  private jobToPayload(job: ProcessingJob): SseProgressPayload {
    return {
      jobId: job.id,
      documentId: job.documentId,
      percent: job.progress,
      stage: job.status.toUpperCase() as SseProgressPayload['stage'],
      message: this.statusToMessage(job),
      currentPage: 0,
      totalPages: 0,
      timestamp: (job.updatedAt ?? job.createdAt).toISOString(),
    };
  }

  /**
   * Generates a human-readable message from the DB job state.
   */
  private statusToMessage(job: ProcessingJob): string {
    switch (job.status) {
      case ProcessingJobStatus.PENDING:
        return 'Job is queued for processing';
      case ProcessingJobStatus.RUNNING:
        return `Processing in progress — ${job.progress}% complete`;
      case ProcessingJobStatus.COMPLETED:
        return 'Processing completed successfully';
      case ProcessingJobStatus.FAILED:
        return job.errorMessage ?? 'Processing failed';
      default:
        return 'Unknown status';
    }
  }

  private isTerminal(status: string): boolean {
    return (
      status === ProcessingJobStatus.COMPLETED ||
      status === ProcessingJobStatus.FAILED
    );
  }

  private async findJob(jobId: string): Promise<ProcessingJob | null> {
    return this.jobRepository.findOne({ where: { id: jobId } });
  }
}
