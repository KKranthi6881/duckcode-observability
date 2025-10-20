import React from 'react';
import { Database, Table, Eye, FileCode, GitBranch } from 'lucide-react';

interface SearchResult {
  object_id: string;
  name: string;
  full_name?: string;
  description?: string;
  object_type: string;
  file_path?: string;
  repository_name?: string;
  confidence_score: number;
  score: number;
}

interface SearchResultsProps {
  results: SearchResult[];
  onSelect: (objectId: string) => void;
  query: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ results, onSelect, query }) => {
  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'table':
        return <Table className="w-4 h-4 text-blue-500" />;
      case 'view':
        return <Eye className="w-4 h-4 text-green-500" />;
      case 'model':
        return <Database className="w-4 h-4 text-purple-500" />;
      default:
        return <FileCode className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      table: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      view: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      model: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    };

    const color = colors[type.toLowerCase()] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${color}`}>
        {type}
      </span>
    );
  };

  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery) return text;

    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div>
      <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
        Results ({results.length})
      </div>
      {results.map((result) => (
        <button
          key={result.object_id}
          onClick={() => onSelect(result.object_id)}
          className="w-full px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0 transition-colors"
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="mt-1">
              {getTypeIcon(result.object_type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Name */}
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {highlightMatch(result.name, query)}
                </h4>
                {getTypeBadge(result.object_type)}
              </div>

              {/* Full Name */}
              {result.full_name && result.full_name !== result.name && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {highlightMatch(result.full_name, query)}
                </p>
              )}

              {/* Description */}
              {result.description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                  {highlightMatch(result.description, query)}
                </p>
              )}

              {/* Meta Info */}
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                {/* Repository */}
                {result.repository_name && (
                  <div className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    <span>{result.repository_name}</span>
                  </div>
                )}

                {/* File Path */}
                {result.file_path && (
                  <div className="flex items-center gap-1">
                    <FileCode className="w-3 h-3" />
                    <span className="truncate max-w-xs">{result.file_path}</span>
                  </div>
                )}

                {/* Confidence Score */}
                <div className={`flex items-center gap-1 ml-auto ${getConfidenceColor(result.confidence_score)}`}>
                  <span className="font-medium">
                    {(result.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Relevance Score */}
            <div className="text-right">
              <div className="text-xs text-gray-400 dark:text-gray-500">
                {result.score.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                relevance
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
