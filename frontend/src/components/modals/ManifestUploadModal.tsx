import React, { useState, useRef } from 'react';
import { X, Upload, FileJson, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import axios from 'axios';

interface ManifestUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  onSuccess?: () => void;
}

export function ManifestUploadModal({
  isOpen,
  onClose,
  connectionId,
  onSuccess
}: ManifestUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadStats, setUploadStats] = useState<{
    models: number;
    sources: number;
    dependencies: number;
    columnLineage: number;
    dbtVersion?: string;
    extractionTier: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file
      if (!file.name.endsWith('.json')) {
        setError('Please select a JSON file');
        return;
      }
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        setError('File too large. Maximum size is 50MB');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        setError('Please select a JSON file');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      // Read file content
      const fileContent = await selectedFile.text();
      
      // Parse to validate JSON
      const manifestJson = JSON.parse(fileContent);

      // Send to backend
      const response = await axios.post(
        `/api/metadata/connections/${connectionId}/upload-manifest`,
        { manifestJson },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        setSuccess(true);
        setUploadStats(response.data.data);
        
        // Call success callback after a brief delay
        setTimeout(() => {
          onSuccess?.();
          handleClose();
        }, 2000);
      } else {
        setError(response.data.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else if (error.message?.includes('JSON')) {
        setError('Invalid JSON file. Please check the file format.');
      } else {
        setError('Upload failed. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setError(null);
    setSuccess(false);
    setUploadStats(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <FileJson className="h-6 w-6 text-blue-400" />
            <h3 className="text-xl font-semibold text-white">Upload manifest.json</h3>
          </div>
          <button 
            onClick={handleClose} 
            className="text-slate-400 hover:text-white transition-colors"
            disabled={uploading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          {!success && (
            <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
              <h4 className="text-sm font-medium text-slate-200 mb-3">
                📝 Generate manifest.json locally:
              </h4>
              <pre className="bg-slate-900 text-slate-300 p-3 rounded text-xs overflow-x-auto font-mono">
{`cd /path/to/your/dbt/project
dbt deps                    # Install dependencies
dbt parse --no-partial-parse
# manifest.json created in target/ folder`}
              </pre>
              <p className="text-xs text-slate-400 mt-3">
                💡 Tip: Fix any dbt errors before uploading. Run <code className="text-blue-400">dbt parse</code> to verify it works.
              </p>
            </div>
          )}

          {/* Upload Area */}
          {!success && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                selectedFile
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!selectedFile ? (
                <div className="space-y-4">
                  <Upload className="h-12 w-12 text-slate-400 mx-auto" />
                  <div>
                    <p className="text-slate-300 font-medium mb-1">
                      Drag and drop your manifest.json here
                    </p>
                    <p className="text-sm text-slate-400">or</p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    disabled={uploading}
                  >
                    Browse Files
                  </button>
                  <p className="text-xs text-slate-500">Maximum file size: 50MB</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <FileJson className="h-12 w-12 text-blue-400 mx-auto" />
                  <div>
                    <p className="text-slate-200 font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-slate-400">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setError(null);
                    }}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                    disabled={uploading}
                  >
                    Choose different file
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-300">Upload Failed</p>
                <p className="text-sm text-red-200 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && uploadStats && (
            <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
                <div>
                  <p className="text-lg font-medium text-green-300">Upload Successful!</p>
                  <p className="text-sm text-green-200">Manifest processed and metadata extracted</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">Models</p>
                  <p className="text-2xl font-bold text-white">{uploadStats.models}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">Sources</p>
                  <p className="text-2xl font-bold text-white">{uploadStats.sources}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">Dependencies</p>
                  <p className="text-2xl font-bold text-white">{uploadStats.dependencies}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">Column Lineage</p>
                  <p className="text-2xl font-bold text-white">{uploadStats.columnLineage}</p>
                </div>
              </div>

              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Extraction Tier</span>
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs font-medium rounded-full">
                    ⭐ GOLD
                  </span>
                </div>
              </div>

              <p className="text-xs text-center text-slate-400">
                Redirecting to metadata view...
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload Manifest
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
