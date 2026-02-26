import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '@docflow/database';
import { HealthModule } from './health/health.module';
import { DocumentProcessingModule } from './document-processing/document-processing.module';

@Module({
  imports: [
    // ── Configuration ─────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),

    // ── Database ──────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('POSTGRES_HOST', 'localhost'),
        port: configService.get<number>('POSTGRES_PORT', 5432),
        username: configService.get<string>('POSTGRES_USER', 'docflow'),
        password: configService.get<string>(
          'POSTGRES_PASSWORD',
          'docflow_secret',
        ),
        database: configService.get<string>('POSTGRES_DB', 'docflow'),
        autoLoadEntities: true,
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    // ── Shared Database Repositories ─────────────────────
    DatabaseModule.forFeature(),

    // ── Feature Modules ───────────────────────────────────
    HealthModule,
    DocumentProcessingModule,
  ],
})
export class AppModule {}
