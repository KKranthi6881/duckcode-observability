import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, GitBranch, Database, FileCode, Layers } from 'lucide-react';

interface ExtractionProgressProps {
  connectionId: string;
  onComplete?: () => void;
}

interface Progress {
  connectionId: string;
  phase: string;
  progress: number;
  message: string;
  startTime: string;
  errors: string[];
}

const PHASE_LABELS: Record<string, string> = {
  queued: 'Queued',
  cloning: 'Cloning Repository',
  installing_deps: 'Installing Dependencies',
  parsing: 'Running dbt parse',
  storing: 'Storing Metadata',
  completed: 'Completed',
  failed: 'Failed'
};

const PHASE_ICONS: Record<string, React.ReactNode> = {
  queued: <Loader2 className="w-5 h-5 animate-spin text-blue-500" />,
  cloning: <GitBranch className="w-5 h-5 text-blue-500" />,
  installing_deps: <Database className="w-5 h-5 text-blue-500" />,
  parsing: <FileCode className="w-5 h-5 text-blue-500" />,
  storing: <Layers className="w-5 h-5 text-blue-500" />,
  completed: <CheckCircle className="w-5 h-5 text-green-500" />,
  failed: <XCircle className="w-5 h-5 text-red-500" />
};

export const ExtractionProgress: React.FC<ExtractionProgressProps> = ({
  connectionId,
  onComplete
}) => {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchProgress = async () => {
      try {
        const response = await fetch(
          `/api/metadata/connections/${connectionId}/progress`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          setProgress(data);

          // If completed or failed, stop polling
          if (data.phase === 'completed' || data.phase === 'failed') {
            if (interval) clearInterval(interval);
            if (data.phase === 'completed' && onComplete) {
              onComplete();
            }
          }
        }
      } catch (err: any) {
        setError(err.message);
        if (interval) clearInterval(interval);
      }
    };

    // Initial fetch
    fetchProgress();

    // Poll every 2 seconds
    interval = setInterval(fetchProgress, 2000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connectionId, onComplete]);

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <XCircle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold text-red-900">Error</h3>
        </div>
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isComplete = progress.phase === 'completed';
  const isFailed = progress.phase === 'failed';

  return (
    <div className={`
      border-2 rounded-lg p-6 transition-all
      ${isComplete ? 'bg-green-50 border-green-200' : ''}
      ${isFailed ? 'bg-red-50 border-red-200' : ''}
      ${!isComplete && !isFailed ? 'bg-blue-50 border-blue-200' : ''}
    `}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {PHASE_ICONS[progress.phase]}
        <div className="flex-1">
          <h3 className={`text-lg font-semibold ${
            isComplete ? 'text-green-900' :
            isFailed ? 'text-red-900' :
            'text-blue-900'
          }`}>
            {PHASE_LABELS[progress.phase] || progress.phase}
          </h3>
          <p className={`text-sm ${
            isComplete ? 'text-green-700' :
            isFailed ? 'text-red-700' :
            'text-blue-700'
          }`}>
            {progress.message}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      {!isComplete && !isFailed && (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-600 mb-2">
            <span>Progress</span>
            <span className="font-medium">{progress.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Phases Checklist */}
      <div className="space-y-2">
        <PhaseItem phase="queued" currentPhase={progress.phase} label="Queued" />
        <PhaseItem phase="cloning" currentPhase={progress.phase} label="Cloning repository" />
        <PhaseItem phase="installing_deps" currentPhase={progress.phase} label="Installing dbt dependencies" />
        <PhaseItem phase="parsing" currentPhase={progress.phase} label="Running dbt parse" />
        <PhaseItem phase="storing" currentPhase={progress.phase} label="Storing metadata in database" />
        <PhaseItem phase="completed" currentPhase={progress.phase} label="Extraction completed" />
      </div>

      {/* Errors */}
      {progress.errors && progress.errors.length > 0 && (
        <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded">
          <p className="text-xs font-medium text-red-900 mb-1">Errors:</p>
          {progress.errors.map((error, index) => (
            <p key={index} className="text-xs text-red-700">• {error}</p>
          ))}
        </div>
      )}

      {/* Duration */}
      {progress.startTime && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Started {new Date(progress.startTime).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

interface PhaseItemProps {
  phase: string;
  currentPhase: string;
  label: string;
}

const PhaseItem: React.FC<PhaseItemProps> = ({ phase, currentPhase, label }) => {
  const phases = ['queued', 'cloning', 'installing_deps', 'parsing', 'storing', 'completed'];
  const currentIndex = phases.indexOf(currentPhase);
  const itemIndex = phases.indexOf(phase);

  const isComplete = itemIndex < currentIndex || currentPhase === 'completed';
  const isCurrent = phase === currentPhase;
  const isPending = itemIndex > currentIndex;

  return (
    <div className="flex items-center gap-3">
      <div className={`
        w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium
        ${isComplete ? 'bg-green-500 text-white' : ''}
        ${isCurrent ? 'bg-blue-500 text-white' : ''}
        ${isPending ? 'bg-gray-300 text-gray-600' : ''}
      `}>
        {isComplete ? '✓' : isCurrent ? '•' : '○'}
      </div>
      <span className={`text-sm ${
        isComplete ? 'text-green-700 font-medium' :
        isCurrent ? 'text-blue-700 font-medium' :
        'text-gray-500'
      }`}>
        {label}
      </span>
      {isCurrent && (
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      )}
    </div>
  );
};
