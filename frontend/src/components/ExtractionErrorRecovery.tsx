import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';
import { ManifestUploadModal } from './modals/ManifestUploadModal';

interface ExtractionErrorRecoveryProps {
  connectionId: string;
  onRetry: () => void;
  onSuccess?: () => void;
}

interface ErrorInfo {
  errorMessage: string;
  guidance: string[];
  recoveryOptions: Array<{
    type: string;
    title: string;
    description: string;
  }>;
}

export function ExtractionErrorRecovery({
  connectionId,
  onRetry,
  onSuccess
}: ExtractionErrorRecoveryProps) {
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const fetchErrorInfo = useCallback(async () => {
    try {
      const response = await axios.get(
        `/api/metadata/connections/${connectionId}/error`
      );
      if (response.data.success) {
        setErrorInfo(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch error info:', error);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    fetchErrorInfo();
  }, [fetchErrorInfo]);

  if (loading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-slate-400 border-t-transparent rounded-full"></div>
          <p className="text-slate-300">Loading error details...</p>
        </div>
      </div>
    );
  }

  if (!errorInfo) {
    return null;
  }

  return (
    <>
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-red-500/20 px-6 py-4 border-b border-red-500/50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-300">
                Metadata Extraction Failed
              </h3>
              <p className="text-sm text-red-200 mt-1">
                manifest.json could not be generated. Choose a recovery option below.
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        <div className="px-6 py-4 bg-slate-800/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-300 mb-2">Error:</p>
              <p className="text-sm text-slate-400 font-mono bg-slate-900 p-3 rounded">
                {errorInfo.errorMessage}
              </p>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show Details
                </>
              )}
            </button>
          </div>

          {/* Detailed Guidance */}
          {showDetails && errorInfo.guidance.length > 0 && (
            <div className="mt-4 bg-slate-900 rounded-lg p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3">
                💡 How to Fix:
              </h4>
              <div className="space-y-1">
                {errorInfo.guidance.map((line, index) => (
                  <p
                    key={index}
                    className={`text-xs font-mono ${
                      line.startsWith('  ')
                        ? 'text-blue-300 pl-4'
                        : line.trim() === ''
                        ? 'h-2'
                        : line.startsWith('❌') || line.startsWith('Fix:')
                        ? 'text-red-300 font-semibold'
                        : line.startsWith('📝')
                        ? 'text-yellow-300 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recovery Options */}
        <div className="px-6 py-4 bg-slate-800/30 border-t border-slate-700">
          <h4 className="text-sm font-medium text-slate-300 mb-4">
            Choose a recovery option:
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1: Retry */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-blue-500 transition-colors">
              <div className="flex items-start gap-3 mb-3">
                <RefreshCw className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <div className="flex-1">
                  <h5 className="text-sm font-semibold text-white mb-1">
                    Fix & Retry Extraction
                  </h5>
                  <p className="text-xs text-slate-400">
                    Fix the errors in your dbt project and try extraction again
                  </p>
                </div>
              </div>
              <button
                onClick={onRetry}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry Extraction
              </button>
            </div>

            {/* Option 2: Upload Manifest */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-green-500 transition-colors">
              <div className="flex items-start gap-3 mb-3">
                <Upload className="h-5 w-5 text-green-400 flex-shrink-0" />
                <div className="flex-1">
                  <h5 className="text-sm font-semibold text-white mb-1">
                    Upload manifest.json
                  </h5>
                  <p className="text-xs text-slate-400">
                    Run "dbt parse" locally and upload the generated manifest.json
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
              >
                Upload Manifest
              </button>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="px-6 py-3 bg-blue-500/10 border-t border-blue-500/30">
          <p className="text-xs text-blue-300">
            ℹ️ For dbt projects, <span className="font-semibold">manifest.json is required</span> for accurate metadata extraction (GOLD tier). 
            File-based parsing is not available to ensure data quality.
          </p>
        </div>
      </div>

      {/* Upload Modal */}
      <ManifestUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        connectionId={connectionId}
        onSuccess={() => {
          setShowUploadModal(false);
          onSuccess?.();
        }}
      />
    </>
  );
}
