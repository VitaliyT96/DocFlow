/**
 * ProgressEvent — payload published to Redis PubSub on channel `doc:{jobId}:progress`.
 *
 * This is the shared contract between the worker (publisher) and any consumer
 * (api-gateway SSE controller, gRPC streaming, future WebSocket gateway).
 *
 * Invariants:
 *   - progress is always in [0, 100]
 *   - status is one of PENDING | RUNNING | COMPLETED | FAILED
 *   - errorMessage is only set when status === FAILED
 *   - publishedAt is an ISO 8601 UTC string
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
