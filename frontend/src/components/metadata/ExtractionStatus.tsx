/**
 * ExtractionStatus Component
 * 
 * Displays metadata extraction status with error recovery options
 * for dbt projects when auto-parse fails
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Upload,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface ExtractionStatusProps {
  connection: {
    id: string;
    repository_name: string;
    status: 'connected' | 'extracting' | 'completed' | 'failed';
    error_message?: string;
    manifest_uploaded?: boolean;
    extraction_tier?: 'GOLD' | 'SILVER' | 'BRONZE';
    models_count?: number;
    sources_count?: number;
    column_lineage_count?: number;
  };
  onUploadManifest?: (connectionId: string) => void;
  onRetry?: (connectionId: string) => void;
}

export const ExtractionStatus: React.FC<ExtractionStatusProps> = ({
  connection,
  onUploadManifest,
  onRetry
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Render based on status
  if (connection.status === 'completed') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-green-900 mb-1">
              ✅ Extraction Completed
            </h4>
            <p className="text-sm text-green-800 mb-2">
              Metadata extracted successfully with{' '}
              <span className="font-semibold">{connection.extraction_tier}</span> tier accuracy
            </p>
            <div className="flex gap-6 text-sm text-green-700">
              <span>📊 {connection.models_count || 0} models</span>
              <span>📁 {connection.sources_count || 0} sources</span>
              <span>🔗 {connection.column_lineage_count || 0} column lineages</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (connection.status === 'extracting') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0 animate-spin" />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-1">
              Extracting Metadata...
            </h4>
            <p className="text-sm text-blue-800">
              Running dbt parse and extracting column lineage. This may take 2-5 minutes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (connection.status === 'failed') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-900 mb-2">
              ❌ Extraction Failed
            </h4>
            
            {/* Error Message */}
            <div className="bg-white border border-red-200 rounded p-3 mb-3">
              <p className="text-sm text-red-800 font-mono">
                {connection.error_message || 'Unknown error occurred'}
              </p>
            </div>

            {/* Error Guidance */}
            <ErrorGuidance errorMessage={connection.error_message || ''} />

            {/* Recovery Options */}
            <div className="mt-4 space-y-2">
              <h5 className="text-sm font-semibold text-red-900 mb-2">
                Recovery Options:
              </h5>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => onUploadManifest?.(connection.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  <Upload className="w-4 h-4" />
                  Upload Manifest.json
                </button>
                
                <button
                  onClick={() => onRetry?.(connection.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Extraction
                </button>
              </div>
            </div>

            {/* How to Test Locally (Collapsible) */}
            <div className="mt-4">
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="flex items-center gap-2 text-sm text-red-700 hover:text-red-900 font-medium"
              >
                {showGuide ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                📋 How to test locally
              </button>
              
              {showGuide && (
                <div className="mt-2 bg-white border border-red-200 rounded p-3">
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="font-semibold text-gray-900">
                      Run these commands in your dbt project:
                    </p>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
{`cd /path/to/your/dbt/project
dbt deps  # Install dependencies
dbt parse --no-partial-parse
ls -lh target/manifest.json  # Verify it was created`}
                    </pre>
                    <p className="text-xs text-gray-600 mt-2">
                      Once manifest.json is generated, upload it using the button above.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error Details (Collapsible) */}
            <div className="mt-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2 text-xs text-red-600 hover:text-red-800"
              >
                {showDetails ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                View error details
              </button>
              
              {showDetails && (
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded p-2">
                  <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
                    {connection.error_message}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default/connected state
  return null;
};

/**
 * ErrorGuidance Component
 * Provides actionable guidance based on error message patterns
 */
const ErrorGuidance: React.FC<{ errorMessage: string }> = ({ errorMessage }) => {
  const lower = errorMessage.toLowerCase();
  const guidance: string[] = [];

  if (lower.includes('profiles.yml') || lower.includes('profile')) {
    guidance.push('❌ profiles.yml configuration issue');
    guidance.push('Fix: Ensure profiles.yml exists and is properly configured');
    guidance.push('Location: ~/.dbt/profiles.yml or your project directory');
  } else if (lower.includes('packages.yml') || lower.includes('package')) {
    guidance.push('❌ Package dependencies issue');
    guidance.push('Fix: Install package dependencies');
    guidance.push('Run: dbt deps');
  } else if (lower.includes('compilation error') || lower.includes('compile')) {
    guidance.push('❌ SQL compilation error');
    guidance.push('Fix: Check your SQL syntax in model files');
    guidance.push('Run: dbt compile --select <model_name>');
  } else if (lower.includes('doc(') || lower.includes('documentation')) {
    guidance.push('❌ Missing documentation reference');
    guidance.push('Fix: Check schema.yml files for undefined doc() calls');
    guidance.push('Remove doc() calls or define them in docs blocks');
  } else if (lower.includes('env_var')) {
    guidance.push('❌ Environment variable not set');
    guidance.push('Fix: Set required environment variables');
    guidance.push('Check dbt_project.yml and profiles.yml for env_var() calls');
  } else if (lower.includes('not found') || lower.includes('does not exist')) {
    guidance.push('❌ dbt project or file not found');
    guidance.push('Fix: Verify dbt_project.yml exists in repository');
    guidance.push('Check: Ensure project is in repository root or specify path');
  } else {
    guidance.push('❌ dbt parse failed');
    guidance.push('General troubleshooting:');
    guidance.push('1. Run "dbt parse" locally to see the full error');
    guidance.push('2. Check logs for specific compilation errors');
    guidance.push('3. Verify all dependencies are installed (dbt deps)');
  }

  if (guidance.length === 0) {
    return null;
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-3">
      <div className="space-y-1">
        {guidance.map((line, idx) => (
          <p key={idx} className="text-sm text-amber-900">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
};
