import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document, ProcessingJob } from '@docflow/database';
import { RedisModule } from '@docflow/redis';
import { DocumentProcessingController } from './document-processing.controller';
import { DocumentProcessingService } from './document-processing.service';

/**
 * Module for gRPC document processing handlers.
 *
 * Registers the controller that implements the DocumentProcessingService
 * proto definition, and provides the business logic service with
 * access to Document and ProcessingJob repositories.
 *
 * RedisModule.forRoot() provides two ioredis connections:
 *   - RedisPublisherService: used by startProcessing() to publish progress events
 *   - RedisSubscriberService: used by getProgress() to relay events to gRPC consumers
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Document, ProcessingJob]),
    RedisModule.forRoot(),
  ],
  controllers: [DocumentProcessingController],
  providers: [DocumentProcessingService],
  exports: [DocumentProcessingService],
})
export class DocumentProcessingModule {}
