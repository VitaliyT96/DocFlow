import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document, ProcessingJob } from '@docflow/database';
import { DocumentProcessingController } from './document-processing.controller';
import { DocumentProcessingService } from './document-processing.service';

/**
 * Module for gRPC document processing handlers.
 *
 * Registers the controller that implements the DocumentProcessingService
 * proto definition, and provides the business logic service with
 * access to Document and ProcessingJob repositories.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Document, ProcessingJob])],
  controllers: [DocumentProcessingController],
  providers: [DocumentProcessingService],
  exports: [DocumentProcessingService],
})
export class DocumentProcessingModule {}
