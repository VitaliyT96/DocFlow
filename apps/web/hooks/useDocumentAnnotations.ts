import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface CursorPosition {
  clientId: string;
  x: number;
  y: number;
  lastUpdate: number;
}

export interface Annotation {
  id?: string;
  text?: string;
  content?: string; // from DTO
  positionX?: number;
  positionY?: number;
  x?: number;
  y?: number;
}

export function useDocumentAnnotations(documentId: string, initialAnnotations: Annotation[] = []) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [cursors, setCursors] = useState<Record<string, CursorPosition>>({});
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);

  useEffect(() => {
    // Connect to the annotations namespace
    const apiUrl = process.env.NEXT_PUBLIC_API_REST_URL?.replace(/^http/, 'ws') || 'ws://localhost:3000';
    
    // The gateway is on namespace '/annotations'
    const newSocket = io(`${apiUrl}/annotations`, {
      transports: ['websocket'],
      withCredentials: true,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      setConnected(true);
      // Join the document room
      newSocket.emit('join-document', { documentId });
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('cursor-changed', (payload: { clientId: string; x: number; y: number }) => {
      setCursors(prev => ({
        ...prev,
        [payload.clientId]: {
          clientId: payload.clientId,
          x: payload.x,
          y: payload.y,
          lastUpdate: Date.now(),
        }
      }));
    });

    newSocket.on('annotation-added', (payload: Annotation) => {
      setAnnotations(prev => [...prev, payload]);
    });

    // Cleanup stale cursors periodically
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setCursors(prev => {
        const next = { ...prev };
        let changed = false;
        for (const [id, cursor] of Object.entries(next)) {
          if (now - cursor.lastUpdate > 10000) { // remove after 10s of inactivity
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);

    return () => {
      clearInterval(cleanupInterval);
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [documentId]);

  // Expose a throttled cursor move function
  const moveCursor = useCallback((x: number, y: number) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('cursor-move', { documentId, x, y });
    }
  }, [connected, documentId]);

  const addAnnotation = useCallback((content: string, x?: number, y?: number) => {
    if (socketRef.current && connected) {
       // Use Gateway's DTO structure
       socketRef.current.emit('add-annotation', { documentId, content });
       
       // Optimistic update
       const tempId = `temp-${Date.now()}`;
       setAnnotations(prev => [...prev, { id: tempId, content, text: content, positionX: x || 0, positionY: y || 0 }]);
    }
  }, [connected, documentId]);

  return { cursors, annotations, connected, moveCursor, addAnnotation };
}
