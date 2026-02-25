import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // ── Global Pipes ──────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── CORS ──────────────────────────────────────────────
  const corsOrigin = configService.get<string>(
    'API_GATEWAY_CORS_ORIGIN',
    'http://localhost:3000',
  );
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // ── Start ─────────────────────────────────────────────
  const port = configService.get<number>('API_GATEWAY_PORT', 4000);
  await app.listen(port);

  logger.log(`🚀 API Gateway running on http://localhost:${port}`);
  logger.log(
    `📊 GraphQL Playground: http://localhost:${port}${configService.get<string>('API_GATEWAY_GRAPHQL_PATH', '/graphql')}`,
  );
}

bootstrap();
