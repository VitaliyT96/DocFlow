import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth';
import { ProgressSseService } from './progress-sse.service';

/**
 * ProgressController — SSE endpoint for streaming document processing progress.
 *
 * Route: GET /documents/:jobId/progress
 *
 * Response: text/event-stream (SSE).
 *
 * Each event uses the SSE spec's `event:` and `id:` fields:
 *   id: 1
 *   event: progress
 *   data: {"jobId":"...","percent":42,"stage":"RUNNING","message":"..."}
 *
 * The stream terminates when:
 *   - The job reaches COMPLETED or FAILED status
 *   - The client disconnects
 *   - The max stream lifetime (5 min) is exceeded
 *
 * If the jobId does not exist, a 404 JSON response is returned immediately
 * (no SSE stream is opened).
 *
 * Authentication:
 *   All requests require a valid JWT (Authorization: Bearer <token>).
 *   jobId ownership is NOT validated here — any authenticated user who knows
 *   a jobId can subscribe. For production, add an ownership check via the
 *   DocumentsService or a dedicated query.
 *
 * Why REST, not GraphQL subscriptions?
 *   SSE is unidirectional, stateless (works with HTTP/1.1 load balancers),
 *   and requires no WebSocket upgrade. It fits this use case better than
 *   GraphQL subscriptions, which require WS infrastructure.
 */
@Controller('documents')
export class ProgressController {
  private readonly logger = new Logger(ProgressController.name);

  constructor(private readonly progressSseService: ProgressSseService) {}

  /**
   * GET /documents/:jobId/progress
   *
   * Returns a Server-Sent Events stream for the given processing job.
   *
   * Headers set before handing off to the service:
   *   Content-Type: text/event-stream
   *   Cache-Control: no-cache
   *   Connection: keep-alive
   *   X-Accel-Buffering: no   — disables nginx response buffering
   *
   * If the job is not found, the service sends a 404 JSON response
   * instead of opening an SSE stream.
   */
  @Get(':jobId/progress')
  @UseGuards(JwtAuthGuard)
  async streamProgress(
    @Param('jobId', new ParseUUIDPipe({ version: '4' })) jobId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(
      `SSE connection request for job ${jobId} from ${req.ip ?? 'unknown'}`,
    );

    // ── SSE headers ─────────────────────────────────────────
    // Set headers before the service writes any data.
    // If the job doesn't exist, the service will override with 404.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Prevent nginx from buffering SSE chunks (critical for real-time delivery)
    res.setHeader('X-Accel-Buffering', 'no');
    // Allow browser EventSource from the Next.js origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    await this.progressSseService.streamProgress(jobId, res);
  }
}
