/**
 * @docflow/proto
 *
 * Shared protobuf definitions for inter-service communication.
 * Proto files are consumed directly by @grpc/proto-loader at runtime.
 *
 * This index file exports path constants for convenience.
 */
import { join } from 'path';

/** Absolute path to the document processing proto file */
export const DOCUMENT_PROTO_PATH: string = join(
  __dirname,
  'document.proto',
);

/** gRPC package name matching the proto `package` directive */
export const DOCFLOW_PACKAGE_NAME = 'docflow';

/** Service name for the document processing gRPC service */
export const DOCUMENT_PROCESSING_SERVICE_NAME = 'DocumentProcessingService';
