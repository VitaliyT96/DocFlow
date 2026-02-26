import { ProcessingJobStatus } from '@docflow/database';

/**
 * Response body for POST /documents/upload (HTTP 201 Created).
 *
 * Contains all information the client needs to:
 * 1. Reference the document in subsequent GraphQL queries
 * 2. Track processing progress via the SSE endpoint (future step)
 * 3. Show upload confirmation in the UI
 */
export class UploadDocumentResponseDto {
  /** UUID of the newly created document record */
  documentId!: string;

  /** UUID of the processing job — used to subscribe to progress events */
  jobId!: string;

  /** Initial job status (always "pending" immediately after upload) */
  status!: ProcessingJobStatus;

  /** Display title (from form field or original filename) */
  title!: string;

  /**
   * Object key in MinIO storage.
   * Pattern: {YYYY}/{uuid}-{sanitized-filename}
   * Example: "2024/f3a2b1c0-report.pdf"
   */
  fileUrl!: string;

  /** File size in bytes */
  fileSizeBytes!: number;

  /** Detected MIME type of the uploaded file */
  mimeType!: string;

  /** ISO timestamp of when the document was created */
  createdAt!: string;
}
