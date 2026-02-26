import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document, ProcessingJob } from '@docflow/database';
import { StorageModule } from '../storage/storage.module';
import { GrpcClientModule } from '../grpc/grpc-client.module';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

/**
 * DocumentsModule — feature module for document upload and management.
 *
 * Imports:
 *   - ConfigModule:     reads UPLOAD_MAX_FILE_SIZE_MB for DocumentsService
 *   - TypeOrmModule:    provides DataSource (used directly for transactions)
 *   - StorageModule:    provides StorageService (MinIO client)
 *   - GrpcClientModule: provides DocumentProcessingClient (worker gRPC stub)
 *
 * Note: DataSource is provided globally by TypeOrmModule.forRoot() in AppModule.
 * We only need the forFeature() call if we used repositories, but since
 * DocumentsService uses DataSource directly for transactions, we do not need
 * forFeature here. The entities are registered in AppModule via DatabaseModule.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Document, ProcessingJob]),
    StorageModule,
    GrpcClientModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
