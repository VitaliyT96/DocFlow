import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
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
 * Each event is a JSON-encoded ProgressEvent on the `data` field:
 *   data: {"jobId":"...","status":"RUNNING","progress":42,...}\n\n
 *
 * The stream terminates when:
 *   - The job reaches COMPLETED or FAILED status
 *   - The client disconnects
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
   */
  @Get(':jobId/progress')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  streamProgress(
    @Param('jobId', new ParseUUIDPipe({ version: '4' })) jobId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    this.logger.log(
      `SSE connection for job ${jobId} from ${req.ip ?? 'unknown'}`,
    );

    // ── SSE headers ─────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Prevent nginx from buffering SSE chunks (critical for real-time delivery)
    res.setHeader('X-Accel-Buffering', 'no');
    // Allow browser EventSource from the Next.js origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    this.progressSseService.streamProgress(jobId, res);
  }
}
