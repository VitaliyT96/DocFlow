'use client';

import { useRef, MouseEvent } from 'react';
import { useProcessingProgress } from '../../../hooks/useProcessingProgress';
import { useDocumentAnnotations, Annotation } from '../../../hooks/useDocumentAnnotations';
import { ProcessingProgress } from '../../../components/ProcessingProgress';

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
  const { status, progress, error: sseError } = useProcessingProgress(initialDocument.id, initialDocument.status);
  const { cursors, annotations, connected, moveCursor, addAnnotation } = useDocumentAnnotations(initialDocument.id, []);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    const y = Math.max(0, e.clientY - rect.top);
    moveCursor(x, y);
  };

  const handleDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    const y = Math.max(0, e.clientY - rect.top);
    
    const content = window.prompt('Enter annotation text:');
    if (content && content.trim()) {
      addAnnotation(content.trim(), x, y);
    }
  };

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
       
      <ProcessingProgress status={status} progress={progress} error={sseError} />
       
      <main 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onDoubleClick={handleDoubleClick}
        className="mt-6 flex-1 bg-white relative border border-slate-200 shadow-sm rounded-lg overflow-hidden flex flex-col cursor-crosshair"
      >
        {!connected && (
          <div className="absolute top-0 right-0 z-50 p-2 m-2 bg-red-100 text-red-700 text-xs rounded shadow">
             Collaboration Offline: Disconnected
          </div>
        )}
        
        <div className="p-8 prose max-w-none text-slate-800">
           {initialDocument.content || 'Document content is empty or still processing...'}
        </div>
        
        {/* Render Annotations */}
        {annotations.map((ann: Annotation, idx: number) => (
          <div 
            key={ann.id || idx}
            className="absolute z-10 bg-yellow-100 border border-yellow-300 text-yellow-900 text-sm p-3 shadow-md rounded-md cursor-pointer hover:bg-yellow-200 transition-colors max-w-[200px]" 
            style={{ left: `${ann.positionX || ann.x || 0}px`, top: `${ann.positionY || ann.y || 0}px` }}
          >
            {ann.text || ann.content || ''}
          </div>
        ))}

        {/* Render Live Cursors */}
        {Object.values(cursors).map((cursor) => (
          <div
            key={cursor.clientId}
            className="absolute z-20 pointer-events-none transition-all duration-100 ease-linear"
            style={{ 
              left: `${cursor.x}px`, 
              top: `${cursor.y}px`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="w-4 h-4 rounded-full bg-blue-500 opacity-75 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            <div className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-md mt-1 whitespace-nowrap shadow-sm">
              User {cursor.clientId.substring(0, 4)}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
