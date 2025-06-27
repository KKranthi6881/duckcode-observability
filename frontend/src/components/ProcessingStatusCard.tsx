import React from 'react';
import { 
  Loader2, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle,
  PlayCircle,
  Eye,
  Trash2
} from 'lucide-react';

interface ProcessingStatus {
  progress: number;
  totalFiles: number;
  completed: number;
  failed: number;
  pending: number;
  detailedStatus?: any[];
  isPolling: boolean;
  lastUpdated: string;
  startedAt: string;
  completedAt?: string;
}

interface ProcessingStatusCardProps {
  repoFullName: string;
  status: ProcessingStatus;
  onViewDetails?: () => void;
  onClearStatus?: () => void;
}

export const ProcessingStatusCard: React.FC<ProcessingStatusCardProps> = ({
  repoFullName,
  status,
  onViewDetails,
  onClearStatus
}) => {
  const getStatusIcon = () => {
    if (status.isPolling) {
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    } else if (status.progress >= 100) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (status.failed > 0) {
      return <AlertCircle className="h-5 w-5 text-orange-500" />;
    } else {
      return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    if (status.isPolling) {
      return "Processing...";
    } else if (status.progress >= 100) {
      return "Completed";
    } else if (status.failed > 0) {
      return "Completed with errors";
    } else {
      return "Paused";
    }
  };

  const getStatusColor = () => {
    if (status.isPolling) {
      return "border-blue-200 bg-blue-50";
    } else if (status.progress >= 100) {
      return "border-green-200 bg-green-50";
    } else if (status.failed > 0) {
      return "border-orange-200 bg-orange-50";
    } else {
      return "border-gray-200 bg-gray-50";
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`border rounded-xl p-5 ${getStatusColor()} transition-all duration-300 hover:shadow-lg hover:scale-[1.02] transform`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            {getStatusIcon()}
          </div>
          <div>
            <h4 className="font-bold text-gray-900 text-sm">{repoFullName}</h4>
            <p className="text-xs text-gray-600 font-medium">{getStatusText()}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
          {onClearStatus && !status.isPolling && (
            <button
              onClick={onClearStatus}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              title="Clear status"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">Analysis Progress</span>
          <span className="text-sm font-bold text-gray-900 px-2 py-1 bg-white rounded-md shadow-sm">
            {Math.round(status.progress)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
          <div 
            className="bg-gradient-to-r from-[#2AB7A9] via-[#24a497] to-[#20a39e] h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
            style={{ width: `${status.progress}%` }}
          ></div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center bg-white rounded-lg p-2 shadow-sm border border-gray-100">
          <div className="text-sm font-bold text-gray-900">{status.totalFiles}</div>
          <div className="text-xs text-gray-600 font-medium">Total</div>
        </div>
        <div className="text-center bg-white rounded-lg p-2 shadow-sm border border-gray-100">
          <div className="text-sm font-bold text-green-600">{status.completed}</div>
          <div className="text-xs text-gray-600 font-medium">Done</div>
        </div>
        <div className="text-center bg-white rounded-lg p-2 shadow-sm border border-gray-100">
          <div className="text-sm font-bold text-orange-600">{status.pending}</div>
          <div className="text-xs text-gray-600 font-medium">Pending</div>
        </div>
        <div className="text-center bg-white rounded-lg p-2 shadow-sm border border-gray-100">
          <div className="text-sm font-bold text-red-600">{status.failed}</div>
          <div className="text-xs text-gray-600 font-medium">Failed</div>
        </div>
      </div>

      {/* Timing Info */}
      <div className="flex items-center justify-between text-xs text-gray-500 bg-white rounded-lg p-2 shadow-sm border border-gray-100">
        <div className="flex items-center space-x-1">
          <Clock className="h-3 w-3" />
          <span>
            {status.completedAt ? (
              <>Completed {formatTime(status.completedAt)}</>
            ) : (
              <>Started {formatTime(status.startedAt)}</>
            )}
          </span>
        </div>
        <span className="font-medium">Updated {formatTime(status.lastUpdated)}</span>
      </div>
      
      {/* Debug Info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
          <div>Polling: {status.isPolling ? '✅' : '❌'}</div>
          <div>Progress: {status.progress}%</div>
          <div>Files: {status.completed}/{status.totalFiles}</div>
        </div>
      )}
    </div>
  );
}; 