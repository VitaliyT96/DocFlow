/**
 * Status of an individual processing job executed by the worker service.
 *
 * Transitions:
 *   PENDING → RUNNING → COMPLETED
 *                     → FAILED
 *
 * A document may have multiple jobs (retries), but only one should be
 * in RUNNING state at any time.
 */
export enum ProcessingJobStatus {
  /** Job created and waiting to be picked up by worker */
  PENDING = 'pending',

  /** Worker is actively processing this job */
  RUNNING = 'running',

  /** Job completed successfully */
  COMPLETED = 'completed',

  /** Job failed (see errorMessage column for details) */
  FAILED = 'failed',
}
