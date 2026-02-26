'use client';

import { useEffect, useState } from 'react';
import { useSubscription, gql } from '@apollo/client';

const ANNOTATION_SUBSCRIPTION = gql`
  subscription OnAnnotationAdded($documentId: String!) {
    annotationAdded(documentId: $documentId) {
      id
      text
      positionX
      positionY
    }
  }
`;

export interface Annotation {
  id: string;
  text: string;
  positionX: number;
  positionY: number;
}

export interface DocumentData {
  id: string;
  title: string;
  status: string;
  content?: string;
}

interface DocWorkspaceProps {
  initialDocument: DocumentData;
}

export function DocumentWorkspace({ initialDocument }: DocWorkspaceProps) {
  const [status, setStatus] = useState<string>(initialDocument.status);
  const [progress, setProgress] = useState<{ percent: number, stage: string } | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  
  useEffect(() => {
    if (status !== 'PROCESSING' && status !== 'PENDING') return;

    const sseUrl = `${process.env.NEXT_PUBLIC_API_REST_URL || 'http://localhost:3000'}/progress/${initialDocument.id}`;
    const eventSource = new EventSource(sseUrl);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress({ percent: data.percent, stage: data.stage });
        
        if (data.percent === 100 || data.stage === 'COMPLETED') {
          setStatus('COMPLETED');
          eventSource.close();
        }
      } catch (err) {
        console.error("Failed to parse SSE payload", err);
      }
    };
    
    eventSource.onerror = () => {
      console.warn('SSE stream lost. Retrying backing off handled by EventSource natively.');
    };

    return () => eventSource.close();
  }, [initialDocument.id, status]);

  const { error: wsError } = useSubscription(ANNOTATION_SUBSCRIPTION, {
    variables: { documentId: initialDocument.id },
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.annotationAdded) {
        setAnnotations(prev => [...prev, subscriptionData.data.annotationAdded]);
      }
    }
  });

  return (
    <div className="p-6 flex-1 flex flex-col max-w-7xl mx-auto w-full">
      <header className="flex justify-between items-center p-4 bg-white rounded shadow-sm">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          {initialDocument.title}
          <span className="text-xs px-2 py-1 bg-slate-100 rounded-full font-medium tracking-wide">
            {status}
          </span>
        </h1>
      </header>
       
      {['PROCESSING', 'PENDING'].includes(status) && progress && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg shadow-sm">
          <div className="flex justify-between text-sm font-semibold text-blue-800 mb-2">
            <span>{progress.stage}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}
       
      <main className="mt-6 flex-1 bg-white relative border border-slate-200 shadow-sm rounded-lg overflow-hidden flex flex-col">
        {wsError && (
          <div className="absolute top-0 right-0 p-2 m-2 bg-red-100 text-red-700 text-xs rounded shadow">
            Collaboration Offline: Cannot connect to WS
          </div>
        )}
        <div className="p-8 prose max-w-none text-slate-800">
           {initialDocument.content || 'Document content is empty or still processing...'}
        </div>
        
        {annotations.map((ann, idx) => (
          <div 
            key={ann.id || idx}
            className="absolute z-10 bg-yellow-100 border border-yellow-300 text-yellow-900 text-sm p-3 shadow-md rounded-md cursor-pointer hover:bg-yellow-200 transition-colors max-w-[200px]" 
            style={{ left: `${ann.positionX}px`, top: `${ann.positionY}px` }}
          >
            {ann.text}
          </div>
        ))}
      </main>
    </div>
  );
}
