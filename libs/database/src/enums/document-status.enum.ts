/**
 * Lifecycle status of a document in the processing pipeline.
 *
 * Transitions:
 *   UPLOADED → PROCESSING → COMPLETED
 *                         → FAILED
 */
export enum DocumentStatus {
  /** Document uploaded but not yet queued for processing */
  UPLOADED = 'uploaded',

  /** Document is actively being processed by a worker */
  PROCESSING = 'processing',

  /** Processing finished successfully */
  COMPLETED = 'completed',

  /** Processing failed (see ProcessingJob.errorMessage for details) */
  FAILED = 'failed',
}
