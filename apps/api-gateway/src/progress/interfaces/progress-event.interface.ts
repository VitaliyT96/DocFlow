/**
 * ProgressEvent — mirrors the worker's published Redis PubSub message.
 *
 * This interface is duplicated here (rather than shared via a lib) to maintain
 * strict service boundaries. The worker owns the canonical definition; the
 * api-gateway's copy must remain structurally compatible.
 *
 * Channel: doc:{jobId}:progress
 */
export interface ProgressEvent {
  jobId: string;
  documentId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  message: string;
  currentPage: number;
  totalPages: number;
  errorMessage?: string;
  publishedAt: string;
}

/**
 * SseProgressPayload — the JSON payload sent to the client inside the
 * SSE `data:` field.
 *
 * Maps internal ProgressEvent fields to the client-facing contract:
 *   { percent, stage, message, ... }
 */
export interface SseProgressPayload {
  /** Job UUID — used by the client to correlate events */
  jobId: string;

  /** Document UUID */
  documentId: string;

  /** Processing progress in [0, 100] */
  percent: number;

  /** Current processing stage: PENDING → RUNNING → COMPLETED | FAILED */
  stage: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

  /** Human-readable description of the current step */
  message: string;

  /** Current page being processed (0 if not yet started) */
  currentPage: number;

  /** Total pages in the document */
  totalPages: number;

  /** Error description, only present when stage === 'FAILED' */
  errorMessage?: string;

  /** ISO 8601 UTC timestamp of this event */
  timestamp: string;
}
