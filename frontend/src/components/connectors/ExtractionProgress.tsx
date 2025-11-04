import { Loader2, Database, Columns } from 'lucide-react';
import { ConnectorHistoryRow } from '../../services/connectorsService';

interface ExtractionProgressProps {
  job: ConnectorHistoryRow | null;
}

export default function ExtractionProgress({ job }: ExtractionProgressProps) {
  if (!job) return null;

  const objectsCount = job.objects_extracted || 0;
  const columnsCount = job.columns_extracted || 0;
  const startTime = job.started_at ? new Date(job.started_at) : null;
  const elapsed = startTime ? Math.floor((Date.now() - startTime.getTime()) / 1000) : 0;

  const formatElapsed = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-blue-900">
            Extraction in progress...
          </span>
        </div>
        {elapsed > 0 && (
          <span className="text-xs text-blue-700">
            {formatElapsed(elapsed)} elapsed
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Database className="w-4 h-4 text-blue-600" />
          <span className="text-blue-900">
            <span className="font-semibold">{objectsCount}</span> objects
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Columns className="w-4 h-4 text-blue-600" />
          <span className="text-blue-900">
            <span className="font-semibold">{columnsCount}</span> columns
          </span>
        </div>
      </div>

      {job.error_message && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <strong>Error:</strong> {job.error_message}
        </div>
      )}
    </div>
  );
}
