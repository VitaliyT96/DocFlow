/**
 * TypeScript interfaces mirroring the document.proto definitions.
 *
 * These are hand-written to match the proto contract without requiring
 * a code-generation step. @grpc/proto-loader handles the runtime proto
 * parsing; these types give us compile-time safety on both sides.
 */
import { Observable } from 'rxjs';

// ── Request / Response Interfaces ───────────────────────

export interface ProcessDocumentRequest {
  documentId: string;
  userId: string;
  filePath: string;
  mimeType: string;
}

export interface ProcessDocumentResponse {
  jobId: string;
  status: string;
  acceptedAt: GrpcTimestamp;
}

export interface GetProgressRequest {
  jobId: string;
}

export interface ProgressUpdate {
  jobId: string;
  status: string;
  progress: number;
  errorMessage: string;
  updatedAt: GrpcTimestamp;
}

// ── gRPC Timestamp ──────────────────────────────────────
// google.protobuf.Timestamp is serialized as { seconds, nanos } over the wire

export interface GrpcTimestamp {
  seconds: number;
  nanos: number;
}

// ── Service Client Interface ────────────────────────────
// Matches the gRPC service definition for use with NestJS ClientGrpc

export interface DocumentProcessingServiceClient {
  /** Unary RPC — initiate document processing */
  processDocument(
    request: ProcessDocumentRequest,
  ): Observable<ProcessDocumentResponse>;

  /** Server-streaming RPC — subscribe to processing progress */
  getProgress(request: GetProgressRequest): Observable<ProgressUpdate>;
}
