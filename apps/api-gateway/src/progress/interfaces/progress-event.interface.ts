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
