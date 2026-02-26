import { useEffect, useState } from 'react';

export interface ProcessingProgress {
  percent: number;
  stage: string;
}

export function useProcessingProgress(documentId: string, initialStatus: string) {
  const [status, setStatus] = useState<string>(initialStatus);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Only subscribe to SSE if the document is still processing
    if (status !== 'PROCESSING' && status !== 'PENDING') return;

    const sseUrl = `${process.env.NEXT_PUBLIC_API_REST_URL || 'http://localhost:3000'}/progress/${documentId}`;
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ProcessingProgress;
          setProgress({ percent: data.percent, stage: data.stage });

          if (data.percent === 100 || data.stage === 'COMPLETED') {
            setStatus('COMPLETED');
            eventSource?.close();
          }
        } catch (err) {
          console.error('Failed to parse SSE payload', err);
          setError(err instanceof Error ? err : new Error('Invalid SSE payload'));
        }
      };

      eventSource.onerror = () => {
        console.warn('SSE stream lost or error. Retrying backoff is handled natively by EventSource.');
        // We do not close here to allow native EventSource reconnects.
      };
    } catch (err) {
      console.error('Failed to establish SSE connection', err);
      setError(err instanceof Error ? err : new Error('Failed to connect to progress stream'));
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [documentId, status]);

  return { status, progress, error, setStatus };
}
