import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessingJob } from '@docflow/database';
import { RedisModule } from '@docflow/redis';
import { ProgressController } from './progress.controller';
import { ProgressSseService } from './progress-sse.service';

/**
 * ProgressModule — feature module for SSE progress streaming.
 *
 * Imports:
 *   - RedisModule.forRoot():  dedicated ioredis subscriber connection.
 *     Each module-level import creates its own connection pool, which is
 *     intentional: keeping the SSE subscriber connection separate from any
 *     publisher connection prevents interference.
 *   - TypeOrmModule.forFeature([ProcessingJob]):  allows ProgressSseService
 *     to validate job existence and deliver the initial DB snapshot.
 *
 * Provides:
 *   - GET /documents/:jobId/progress  (JWT-guarded SSE endpoint)
 */
@Module({
  imports: [
    RedisModule.forRoot(),
    TypeOrmModule.forFeature([ProcessingJob]),
  ],
  controllers: [ProgressController],
  providers: [ProgressSseService],
})
export class ProgressModule {}
