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
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-md">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-base mb-1">{model.name}</h3>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Database className="w-3 h-3" />
            <span className="capitalize">{model.type.replace(/_/g, ' ')}</span>
          </div>
        </div>
        {model.extractionTier && getTierBadge(model.extractionTier)}
      </div>

      {/* Description */}
      {model.description && (
        <div className="mb-3 pb-3 border-b border-gray-100">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700 leading-relaxed">{model.description}</p>
          </div>
        </div>
      )}

      {/* File Path */}
      {model.filePath && (
        <div className="mb-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-xs">
            <FileCode className="w-3 h-3 text-gray-400" />
            <code className="text-gray-600 bg-gray-50 px-2 py-0.5 rounded font-mono">
              {model.filePath}
            </code>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Upstream */}
        <div className="bg-blue-50 rounded-lg p-2">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-900">Upstream</span>
          </div>
          <div className="text-lg font-bold text-blue-700">{model.upstreamCount}</div>
          <div className="text-xs text-blue-600">dependencies</div>
        </div>

        {/* Downstream */}
        <div className="bg-purple-50 rounded-lg p-2">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-purple-900">Downstream</span>
          </div>
          <div className="text-lg font-bold text-purple-700">{model.downstreamCount}</div>
          <div className="text-xs text-purple-600">dependents</div>
        </div>
      </div>

      {/* Confidence Score */}
      {model.confidence !== undefined && (
        <div className="mb-3 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Extraction Confidence</span>
            <span className={`text-sm font-bold ${getConfidenceColor(model.confidence)}`}>
              {(model.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                model.confidence >= 0.9 ? 'bg-green-500' :
                model.confidence >= 0.7 ? 'bg-yellow-500' :
                'bg-orange-500'
              }`}
              style={{ width: `${model.confidence * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Last Updated */}
      {model.updatedAt && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Calendar className="w-3 h-3" />
          <span>Updated {formatDate(model.updatedAt)}</span>
        </div>
      )}

      {/* Additional Metadata */}
      {model.metadata && Object.keys(model.metadata).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs font-medium text-gray-600 mb-2">Additional Info</div>
          <div className="space-y-1">
            {Object.entries(model.metadata).slice(0, 3).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="text-gray-700 font-medium">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
