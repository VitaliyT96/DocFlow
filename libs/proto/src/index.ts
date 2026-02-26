/**
 * @docflow/proto
 *
 * Shared protobuf definitions and TypeScript interfaces for
 * inter-service gRPC communication.
 *
 * - Proto files are consumed at runtime by @grpc/proto-loader
 * - TypeScript interfaces provide compile-time type safety
 * - gRPC exceptions provide a shared error contract
 */
import { join } from 'path';

// ── Proto File Paths ────────────────────────────────────

/** Absolute path to the document processing proto file */
export const DOCUMENT_PROTO_PATH: string = join(
  __dirname,
  'document.proto',
);

// ── Package & Service Constants ─────────────────────────

/** gRPC package name matching the proto `package` directive */
export const DOCFLOW_PACKAGE_NAME = 'docflow';

/** Service name for the document processing gRPC service */
export const DOCUMENT_PROCESSING_SERVICE_NAME = 'DocumentProcessingService';

/** NestJS injection token for the worker gRPC client */
export const WORKER_GRPC_CLIENT = 'WORKER_GRPC_CLIENT';

// ── TypeScript Interfaces ───────────────────────────────

export {
  ProcessDocumentRequest,
  ProcessDocumentResponse,
  GetProgressRequest,
  ProgressUpdate,
  GrpcTimestamp,
  DocumentProcessingServiceClient,
} from './interfaces';

// ── gRPC Exceptions ─────────────────────────────────────

export {
  GrpcNotFoundException,
  GrpcInvalidArgumentException,
  GrpcInternalException,
  GrpcAlreadyExistsException,
  GrpcUnavailableException,
} from './grpc-exceptions';
