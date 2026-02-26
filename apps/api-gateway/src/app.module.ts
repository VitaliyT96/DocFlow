import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '@docflow/database';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { GrpcClientModule } from './grpc/grpc-client.module';
import { DocumentsModule } from './documents/documents.module';
import { ProgressModule } from './progress/progress.module';
import { GraphqlApiModule } from './graphql/graphql-api.module';
import { AnnotationsModule } from './documents/annotations/annotations.module';

@Module({
  imports: [
    // ── Configuration ─────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),

    // ── GraphQL ───────────────────────────────────────────
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        autoSchemaFile: true,
        sortSchema: true,
        path: configService.get<string>(
          'API_GATEWAY_GRAPHQL_PATH',
          '/graphql',
        ),
        playground: true,
        context: ({ req, res }: { req: Request; res: Response }) => ({
          req,
          res,
        }),
      }),
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
    AuthModule,
    GrpcClientModule,
    DocumentsModule,
    ProgressModule,
    GraphqlApiModule,
    AnnotationsModule,
  ],
})
export class AppModule {}
