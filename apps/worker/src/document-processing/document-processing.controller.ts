import { Controller } from '@nestjs/common';
import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import {
  ProcessDocumentRequest,
  ProcessDocumentResponse,
  GetProgressRequest,
  ProgressUpdate,
  DOCUMENT_PROCESSING_SERVICE_NAME,
} from '@docflow/proto';
import { DocumentProcessingService } from './document-processing.service';

/**
 * gRPC controller for the DocumentProcessingService.
 *
 * Maps proto RPC methods to NestJS handler methods:
 * - ProcessDocument → unary request/response
 * - GetProgress → server-streaming (returns Observable)
 */
@Controller()
export class DocumentProcessingController {
  constructor(
    private readonly documentProcessingService: DocumentProcessingService,
  ) {}

  /**
   * Unary RPC: ProcessDocument
   *
   * Receives a processing request, creates a job, returns the job ID.
   * The @GrpcMethod decorator maps this to the proto service method.
   */
  @GrpcMethod(DOCUMENT_PROCESSING_SERVICE_NAME, 'ProcessDocument')
  async processDocument(
    request: ProcessDocumentRequest,
  ): Promise<ProcessDocumentResponse> {
    return this.documentProcessingService.processDocument(request);
  }

  /**
   * Server-streaming RPC: GetProgress
   *
   * Streams progress updates back to the caller until the job
   * reaches a terminal state (COMPLETED or FAILED).
   */
  @GrpcStreamMethod(DOCUMENT_PROCESSING_SERVICE_NAME, 'GetProgress')
  getProgress(request: Observable<GetProgressRequest>): Observable<ProgressUpdate> {
    // For server-streaming, NestJS delivers the initial request via
    // the observable's first emission. We subscribe to extract the job_id,
    // then delegate to the service for the actual progress stream.
    //
    // Note: @GrpcStreamMethod with server-streaming receives the request
    // as a single object (not a stream). NestJS wraps it in an Observable
    // for the bi-directional pattern, but for server-streaming we get
    // exactly one emission.

    let progressStream: Observable<ProgressUpdate> | null = null;

    return new Observable<ProgressUpdate>((subscriber) => {
      request.subscribe({
        next: (data: GetProgressRequest) => {
          if (progressStream) {
            // Ignore subsequent emissions for server-streaming
            return;
          }

          progressStream = this.documentProcessingService.getProgress(
            data.jobId,
          );

          progressStream.subscribe({
            next: (update) => subscriber.next(update),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        },
        error: (err) => subscriber.error(err),
      });
    });
  }
}
