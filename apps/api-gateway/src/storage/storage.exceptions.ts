import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when a file upload to the object store fails.
 *
 * Maps to HTTP 502 Bad Gateway because the failure is in the upstream
 * storage service (MinIO), not in the client's request.
 */
export class StorageUploadException extends HttpException {
  constructor(filename: string, cause: Error) {
    super(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        error: 'Bad Gateway',
        message: `Failed to upload file "${filename}" to object storage`,
      },
      HttpStatus.BAD_GATEWAY,
      { cause },
    );
  }
}
