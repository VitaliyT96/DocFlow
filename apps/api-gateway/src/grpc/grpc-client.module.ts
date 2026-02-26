import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  WORKER_GRPC_CLIENT,
  DOCFLOW_PACKAGE_NAME,
  DOCUMENT_PROTO_PATH,
} from '@docflow/proto';
import { DocumentProcessingClient } from './document-processing.client';

/**
 * Module that configures and provides the gRPC client connection
 * to the worker service.
 *
 * Other modules (e.g., document GraphQL resolvers) import this module
 * to get access to DocumentProcessingClient for making gRPC calls.
 *
 * Connection is established lazily on first RPC call,
 * with the target address read from environment variables.
 */
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: WORKER_GRPC_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: DOCFLOW_PACKAGE_NAME,
            protoPath: DOCUMENT_PROTO_PATH,
            url: `${configService.get<string>('WORKER_GRPC_HOST', 'localhost')}:${configService.get<number>('WORKER_GRPC_PORT', 50051)}`,
          },
        }),
      },
    ]),
  ],
  providers: [DocumentProcessingClient],
  exports: [DocumentProcessingClient],
})
export class GrpcClientModule {}
