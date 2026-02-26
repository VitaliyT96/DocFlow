import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

/**
 * Thrown when a document cannot be found by ID (or is not owned by the requester).
 */
export class DocumentNotFoundException extends NotFoundException {
  constructor(documentId: string) {
    super(`Document with ID "${documentId}" not found`);
  }
}

/**
 * Thrown when a processing job cannot be found by ID (or the parent document
 * is not owned by the requester).
 */
export class ProcessingJobNotFoundException extends NotFoundException {
  constructor(jobId: string) {
    super(`Processing job with ID "${jobId}" not found`);
  }
}

/**
 * Thrown when the authenticated user attempts to access a document
 * they do not own. This is a data isolation violation.
 */
export class DocumentOwnershipException extends ForbiddenException {
  constructor(documentId: string) {
    super(
      `You do not have permission to access document "${documentId}"`,
    );
  }
}

/**
 * Thrown when a retry is requested for a job that is not in FAILED state.
 * Only FAILED jobs can be retried.
 */
export class RetryNotAllowedException extends BadRequestException {
  constructor(jobId: string, currentStatus: string) {
    super(
      `Cannot retry job "${jobId}": current status is "${currentStatus}". ` +
        `Only jobs in "failed" status can be retried.`,
    );
  }
}
