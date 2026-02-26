import React from 'react';
import type { ProcessingProgress as ProgressType } from '../hooks/useProcessingProgress';

interface ProcessingProgressProps {
  status: string;
  progress: ProgressType | null;
  error: Error | null;
}

export function ProcessingProgress({ status, progress, error }: ProcessingProgressProps) {
  if (error) {
    return (
      <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg shadow-sm text-red-700 text-sm">
        <p className="font-semibold text-red-800">Connection Error</p>
        <p>{error.message}</p>
      </div>
    );
  }

  if (!['PROCESSING', 'PENDING'].includes(status) || !progress) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg shadow-sm">
      <div className="flex justify-between text-sm font-semibold text-blue-800 mb-2">
        <span>{progress.stage}</span>
        <span>{Math.round(progress.percent)}%</span>
      </div>
      <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out" 
          style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
        />
      </div>
    </div>
  );
}
