import { HttpException, HttpStatus } from '@nestjs/common';

/** Allowed MIME types for document upload. Exported for use in controller validation. */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Thrown when the uploaded file's MIME type is not on the allowlist.
 * Maps to HTTP 415 Unsupported Media Type.
 */
export class InvalidMimeTypeException extends HttpException {
  constructor(receivedMimeType: string) {
    super(
      {
        statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        error: 'Unsupported Media Type',
        message: `File type "${receivedMimeType}" is not supported. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      },
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    );
  }
}

/**
 * Thrown when no file is attached to the upload request.
 * Maps to HTTP 400 Bad Request.
 */
export class MissingFileException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'A file must be attached to the "file" multipart field',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Thrown when the uploaded file exceeds the configured size limit.
 * Maps to HTTP 413 Content Too Large.
 */
export class FileTooLargeException extends HttpException {
  constructor(maxSizeMb: number) {
    super(
      {
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        error: 'Payload Too Large',
        message: `File exceeds the maximum allowed size of ${maxSizeMb} MB`,
      },
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }
}

/**
 * Thrown when the document or processing job cannot be persisted.
 * Wraps internal DB errors without leaking implementation details.
 * Maps to HTTP 500 Internal Server Error.
 */
export class DocumentCreationException extends HttpException {
  constructor(cause: Error) {
    super(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Failed to create document record. Please try again.',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
      { cause },
    );
  }
}

/**
 * Thrown when the gRPC dispatch to the worker fails after the document
 * has already been persisted.
 *
 * NOTE: This is a non-fatal error for the system — the document exists
 * in the DB and can be retried. However, we surface it to the caller so
 * they know processing has not yet started.
 *
 * Maps to HTTP 202 Accepted (document created, processing deferred).
 */
export class GrpcDispatchException extends HttpException {
  constructor(documentId: string, cause: Error) {
    super(
      {
        statusCode: HttpStatus.ACCEPTED,
        error: 'Processing Deferred',
        message: `Document ${documentId} was saved but worker could not be notified. Processing will start on retry.`,
      },
      HttpStatus.ACCEPTED,
      { cause },
    );
  }
}
