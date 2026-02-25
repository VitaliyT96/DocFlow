import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // Create a hybrid application: HTTP for health checks + gRPC for processing
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  const grpcHost = configService.get<string>('WORKER_GRPC_HOST', '0.0.0.0');
  const grpcPort = configService.get<number>('WORKER_GRPC_PORT', 50051);

  // ── gRPC Microservice ───────────────────────────────────
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'docflow',
      protoPath: join(__dirname, '../../../libs/proto/src/document.proto'),
      url: `${grpcHost}:${grpcPort}`,
    },
  });

  // Start all microservices, then the HTTP server for health checks
  await app.startAllMicroservices();

  const httpPort = configService.get<number>('WORKER_HTTP_PORT', 50052);
  await app.listen(httpPort);

  logger.log(`🔧 Worker gRPC server listening on ${grpcHost}:${grpcPort}`);
  logger.log(`💓 Worker health check on http://localhost:${httpPort}/health`);
}

bootstrap();
