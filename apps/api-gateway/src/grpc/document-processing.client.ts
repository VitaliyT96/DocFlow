import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom, timeout, catchError } from 'rxjs';
import {
  WORKER_GRPC_CLIENT,
  DOCUMENT_PROCESSING_SERVICE_NAME,
  DocumentProcessingServiceClient,
  ProcessDocumentRequest,
  ProcessDocumentResponse,
  GetProgressRequest,
  ProgressUpdate,
} from '@docflow/proto';

/** Default timeout for unary gRPC calls (in milliseconds) */
const GRPC_UNARY_TIMEOUT_MS = 10_000;

/**
 * Type-safe wrapper around the raw gRPC client stub for
 * DocumentProcessingService.
 *
 * Implements OnModuleInit to resolve the service interface
 * from the gRPC client on application startup.
 *
 * This class is the single entry point for api-gateway code
 * to communicate with the worker service via gRPC.
 */
@Injectable()
export class DocumentProcessingClient implements OnModuleInit {
  private readonly logger = new Logger(DocumentProcessingClient.name);
  private grpcService!: DocumentProcessingServiceClient;

  constructor(
    @Inject(WORKER_GRPC_CLIENT)
    private readonly client: ClientGrpc,
  ) {}

  /**
   * Resolve the gRPC service interface on module initialization.
   * This is called once when the NestJS module boots up.
   */
  onModuleInit(): void {
    this.grpcService =
      this.client.getService<DocumentProcessingServiceClient>(
        DOCUMENT_PROCESSING_SERVICE_NAME,
      );
    this.logger.log(
      `gRPC client initialized for ${DOCUMENT_PROCESSING_SERVICE_NAME}`,
    );
  }

  /**
   * Unary RPC: initiate document processing.
   *
   * Returns a Promise (not Observable) for ergonomic use in resolvers.
   * Applies a timeout to prevent hanging on unreachable worker.
   */
  async processDocument(
    request: ProcessDocumentRequest,
  ): Promise<ProcessDocumentResponse> {
    this.logger.debug(
      `Calling ProcessDocument for document ${request.documentId}`,
    );

    return lastValueFrom(
      this.grpcService.processDocument(request).pipe(
        timeout(GRPC_UNARY_TIMEOUT_MS),
        catchError((error: Error) => {
          this.logger.error(
            `ProcessDocument failed for document ${request.documentId}: ${error.message}`,
          );
          throw error;
        }),
      ),
    );
  }

  /**
   * Server-streaming RPC: subscribe to processing progress.
   *
   * Returns an Observable that emits ProgressUpdate messages
   * until the job reaches a terminal state.
   */
  getProgress(jobId: string): Observable<ProgressUpdate> {
    this.logger.debug(`Subscribing to progress for job ${jobId}`);

    const request: GetProgressRequest = { jobId };

    return this.grpcService.getProgress(request).pipe(
      catchError((error: Error) => {
        this.logger.error(
          `GetProgress stream failed for job ${jobId}: ${error.message}`,
        );
        throw error;
      }),
    );
  }
}
