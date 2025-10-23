import React from 'react';
import { Database, FileCode, Calendar, TrendingUp, TrendingDown, Award, Info } from 'lucide-react';

interface ModelTooltipProps {
  model: {
    name: string;
    type: string;
    description?: string;
    filePath?: string;
    updatedAt?: string;
    upstreamCount: number;
    downstreamCount: number;
    extractionTier?: string;
    confidence?: number;
    metadata?: any;
  };
}

export const ModelTooltip: React.FC<ModelTooltipProps> = ({ model }) => {
  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getTierBadge = (tier?: string) => {
    if (!tier) return null;
    
    const colors = {
      GOLD: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      SILVER: 'bg-gray-100 text-gray-800 border-gray-300',
      BRONZE: 'bg-orange-100 text-orange-800 border-orange-300'
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[tier as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        <Award className="w-3 h-3 mr-1" />
        {tier}
      </span>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="relative">
      {/* Arrow pointer pointing left to the node */}
      <div className="absolute left-0 top-8 -ml-2 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-white" style={{ filter: 'drop-shadow(-1px 0 1px rgba(0,0,0,0.1))' }}></div>
      
      <div className="bg-white rounded-xl shadow-2xl border-2 border-gray-200 overflow-hidden" style={{ width: '420px', maxWidth: '90vw' }}>
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base mb-1 truncate">{model.name}</h3>
              <div className="flex items-center gap-2 text-xs text-blue-100">
                <Database className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="capitalize">{model.type.replace(/_/g, ' ')}</span>
              </div>
            </div>
            {model.extractionTier && (
              <div className="ml-2 flex-shrink-0">
                {getTierBadge(model.extractionTier)}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Description Section */}
          {model.description && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Description</h4>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed pl-6 whitespace-pre-wrap break-words font-normal">{model.description}</p>
            </div>
          )}

          {/* File Path Section */}
          {model.filePath && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <FileCode className="w-4 h-4 text-green-600" />
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">File Location</h4>
              </div>
              <code className="text-xs text-gray-700 bg-gray-50 px-3 py-1.5 rounded border border-gray-200 font-mono block break-all">
                {model.filePath}
              </code>
            </div>
          )}

          {/* Lineage Stats Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Lineage Impact</h4>
            <div className="grid grid-cols-2 gap-3">
              {/* Upstream */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-900">Upstream</span>
                </div>
                <div className="text-2xl font-bold text-blue-700">{model.upstreamCount}</div>
                <div className="text-xs text-blue-600 font-medium">dependencies</div>
              </div>

              {/* Downstream */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <TrendingDown className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-900">Downstream</span>
                </div>
                <div className="text-2xl font-bold text-purple-700">{model.downstreamCount}</div>
                <div className="text-xs text-purple-600 font-medium">dependents</div>
              </div>
            </div>
          </div>

          {/* Confidence Score Section */}
          {model.confidence !== undefined && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Data Quality</h4>
                <span className={`text-sm font-bold ${getConfidenceColor(model.confidence)}`}>
                  {(model.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    model.confidence >= 0.9 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                    model.confidence >= 0.7 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                    'bg-gradient-to-r from-orange-500 to-orange-600'
                  }`}
                  style={{ width: `${model.confidence * 100}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">Extraction confidence score</div>
            </div>
          )}

          {/* Metadata Section */}
          {model.metadata && Object.keys(model.metadata).length > 0 && (
            <div className="mb-4 pt-4 border-t border-gray-200">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Additional Details</h4>
              <div className="space-y-2">
                {Object.entries(model.metadata).slice(0, 5).map(([key, value]) => (
                  <div key={key} className="flex flex-col text-xs bg-gray-50 px-3 py-2 rounded gap-1">
                    <span className="text-gray-600 font-semibold text-[10px] uppercase tracking-wide">{key.replace(/_/g, ' ')}</span>
                    <span className="text-gray-700 font-normal break-words whitespace-pre-wrap">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer - Last Updated */}
          {model.updatedAt && (
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>Last updated {formatDate(model.updatedAt)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
