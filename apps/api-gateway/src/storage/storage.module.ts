import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';

/**
 * StorageModule — provides object storage access via MinIO.
 *
 * Import this module in any feature module that needs to upload files.
 * ConfigModule is imported here to guarantee ConfigService is available
 * to StorageService even if consumers don't import it themselves.
 */
@Module({
  imports: [ConfigModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
