import { Module } from '@nestjs/common';
import { RedisModule } from '@docflow/redis';
import { ProgressController } from './progress.controller';
import { ProgressSseService } from './progress-sse.service';

/**
 * ProgressModule — feature module for SSE progress streaming.
 *
 * Imports RedisModule.forRoot() to get a dedicated ioredis subscriber
 * connection. Each module-level import creates its own connection pool,
 * which is intentional: keeping the SSE subscriber connection separate
 * from any publisher connection prevents interference.
 *
 * Provides:
 *   - GET /documents/:jobId/progress  (JWT-guarded SSE endpoint)
 */
@Module({
  imports: [RedisModule.forRoot()],
  controllers: [ProgressController],
  providers: [ProgressSseService],
})
export class ProgressModule {}
