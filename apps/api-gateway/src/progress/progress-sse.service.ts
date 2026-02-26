import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { RedisSubscriberService } from '@docflow/redis';
import { ProgressEvent } from './interfaces/progress-event.interface';

/** Channel key factory — must match the worker's publisher */
function progressChannel(jobId: string): string {
  return `doc:${jobId}:progress`;
}

/**
 * ProgressSseService — bridges Redis PubSub to HTTP Server-Sent Events.
 *
 * Responsibilities:
 * - Subscribe to the Redis channel for a given job
 * - Write SSE-formatted data frames to the Express response object
 * - Detect terminal events (COMPLETED / FAILED) and end the response
 * - Clean up the Redis subscription on client disconnect
 *
 * SSE wire format:
 *   data: <json-payload>\n\n
 *
 * The controller is responsible for setting the correct response headers
 * before calling streamProgress(). This service only writes body frames.
 */
@Injectable()
export class ProgressSseService {
  private readonly logger = new Logger(ProgressSseService.name);

  constructor(private readonly subscriber: RedisSubscriberService) {}

  /**
   * Streams progress events for `jobId` to the Express `res` object.
   *
   * The method sets up the Redis subscription, pipes events as SSE data
   * frames, and terminates gracefully when either:
   *   a) The job reaches a terminal state (COMPLETED / FAILED)
   *   b) The HTTP client disconnects (req close event)
   *
   * @param jobId - UUID of the processing job to stream
   * @param res   - Express response (caller must have set SSE headers)
   * @param onClose - optional callback invoked after cleanup (for testing)
   */
  streamProgress(jobId: string, res: Response, onClose?: () => void): void {
    const channel = progressChannel(jobId);
    this.logger.log(`SSE stream opened for job ${jobId}`);

    const subscription = this.subscriber
      .subscribeJson<ProgressEvent>(channel)
      .subscribe({
        next: (event: ProgressEvent) => {
          this.writeSseFrame(res, event);

          if (event.status === 'COMPLETED' || event.status === 'FAILED') {
            this.logger.log(
              `Job ${jobId} reached terminal state: ${event.status}. Closing SSE stream.`,
            );
            res.end();
            subscription.unsubscribe();
            onClose?.();
          }
        },
        error: (err: Error) => {
          this.logger.error(
            `Redis subscription error for job ${jobId}: ${err.message}`,
          );
          // Send an error event before closing so the client can display it
          this.writeSseFrame(res, {
            jobId,
            documentId: '',
            status: 'FAILED',
            progress: 0,
            message: 'Stream error — please retry',
            currentPage: 0,
            totalPages: 0,
            errorMessage: err.message,
            publishedAt: new Date().toISOString(),
          });
          res.end();
          onClose?.();
        },
        complete: () => {
          this.logger.debug(`Redis subscription completed for job ${jobId}`);
          res.end();
          onClose?.();
        },
      });

    // Cleanup on client-side disconnect (browser tab close, network drop)
    res.on('close', () => {
      this.logger.log(`Client disconnected from SSE stream for job ${jobId}`);
      subscription.unsubscribe();
      onClose?.();
    });
  }

  // ── Private helpers ──────────────────────────────────────

  private writeSseFrame(res: Response, payload: ProgressEvent): void {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to write SSE frame for job ${payload.jobId}: ${message}`);
    }
  }
}
