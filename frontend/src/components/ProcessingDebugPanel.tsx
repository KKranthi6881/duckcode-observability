import React, { useState } from 'react';
import { useProcessingStatus } from '../context/ProcessingStatusContext';
import { Bug, RefreshCw, Trash2 } from 'lucide-react';

export const ProcessingDebugPanel: React.FC = () => {
  const { processingStatuses, startProcessing, clearAllStatuses } = useProcessingStatus();
  const [testRepo, setTestRepo] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-purple-600 text-white p-2 rounded-full shadow-lg hover:bg-purple-700 transition-colors"
        title="Debug Panel"
      >
        <Bug className="h-5 w-5" />
      </button>

      {/* Debug Panel */}
      {isVisible && (
        <div className="absolute bottom-12 right-0 w-96 bg-white border border-gray-200 rounded-lg shadow-xl p-4 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Processing Debug</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => clearAllStatuses()}
                className="text-red-600 hover:text-red-700"
                title="Clear All"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="text-gray-600 hover:text-gray-700"
              >
                ×
              </button>
            </div>
          </div>

          {/* Test Controls */}
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Repository
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={testRepo}
                onChange={(e) => setTestRepo(e.target.value)}
                placeholder="owner/repo"
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <button
                onClick={() => testRepo && startProcessing(testRepo)}
                disabled={!testRepo}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Start
              </button>
            </div>
          </div>

          {/* Current Statuses */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700">
              Active Statuses ({Object.keys(processingStatuses).length})
            </h4>
            
            {Object.keys(processingStatuses).length === 0 ? (
              <p className="text-gray-500 text-sm">No processing statuses</p>
            ) : (
              Object.entries(processingStatuses).map(([repoFullName, status]) => (
                <div key={repoFullName} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{repoFullName}</span>
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${
                        status.isPolling ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                      }`} />
                      <span className="text-xs text-gray-500">
                        {status.isPolling ? 'Polling' : 'Stopped'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Progress: {status.progress}%</div>
                    <div>Total: {status.totalFiles}</div>
                    <div>Completed: {status.completed}</div>
                    <div>Pending: {status.pending}</div>
                    <div>Failed: {status.failed}</div>
                    <div>Updated: {new Date(status.lastUpdated).toLocaleTimeString()}</div>
                  </div>
                  
                  {status.detailedStatus && status.detailedStatus.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-600 mb-1">Files:</div>
                      <div className="max-h-20 overflow-y-auto text-xs space-y-1">
                        {status.detailedStatus.slice(0, 5).map((file: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="truncate flex-1">{file.filePath}</span>
                            <span className={`ml-2 px-1 rounded text-xs ${
                              file.status === 'completed' ? 'bg-green-100 text-green-800' :
                              file.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {file.status}
                            </span>
                          </div>
                        ))}
                        {status.detailedStatus.length > 5 && (
                          <div className="text-gray-500">
                            +{status.detailedStatus.length - 5} more files
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 