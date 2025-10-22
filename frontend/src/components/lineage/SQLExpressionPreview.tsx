import React from 'react';
import { Code, Zap, ArrowRight } from 'lucide-react';

interface SQLExpressionPreviewProps {
  expression: string;
  transformationType?: string;
  confidence?: number;
  sourceColumns?: Array<{
    table: string;
    column: string;
  }>;
}

export const SQLExpressionPreview: React.FC<SQLExpressionPreviewProps> = ({
  expression,
  transformationType,
  confidence,
  sourceColumns
}) => {
  const getTransformationBadge = (type?: string) => {
    if (!type) return null;

    const badges = {
      direct: { color: 'bg-blue-100 text-blue-800', label: 'Direct' },
      calculated: { color: 'bg-purple-100 text-purple-800', label: 'Calculated' },
      aggregated: { color: 'bg-green-100 text-green-800', label: 'Aggregated' },
      joined: { color: 'bg-yellow-100 text-yellow-800', label: 'Joined' },
      filtered: { color: 'bg-orange-100 text-orange-800', label: 'Filtered' }
    };

    const badge = badges[type as keyof typeof badges] || { color: 'bg-gray-100 text-gray-800', label: type };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
        <Zap className="w-3 h-3 mr-1" />
        {badge.label}
      </span>
    );
  };

  const highlightSQLKeywords = (sql: string) => {
    const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 
                      'GROUP BY', 'ORDER BY', 'HAVING', 'AS', 'ON', 'AND', 'OR', 'SUM', 
                      'COUNT', 'AVG', 'MAX', 'MIN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'];
    
    let highlighted = sql;
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      highlighted = highlighted.replace(regex, `<span class="text-blue-600 font-semibold">${keyword}</span>`);
    });
    
    return highlighted;
  };

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-gray-600" />
          <h4 className="font-semibold text-gray-900 text-sm">Transformation Logic</h4>
        </div>
        <div className="flex items-center gap-2">
          {transformationType && getTransformationBadge(transformationType)}
          {confidence !== undefined && (
            <span className={`text-xs font-medium ${
              confidence >= 0.9 ? 'text-green-600' :
              confidence >= 0.7 ? 'text-yellow-600' :
              'text-orange-600'
            }`}>
              {(confidence * 100).toFixed(0)}% confidence
            </span>
          )}
        </div>
      </div>

      {/* SQL Expression */}
      <div className="bg-gray-900 rounded-lg p-3 mb-3 overflow-x-auto">
        <pre className="text-sm font-mono text-gray-100 whitespace-pre-wrap">
          <code dangerouslySetInnerHTML={{ __html: highlightSQLKeywords(expression) }} />
        </pre>
      </div>

      {/* Source Columns */}
      {sourceColumns && sourceColumns.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-600 mb-2">Source Columns</div>
          <div className="flex flex-wrap gap-2">
            {sourceColumns.map((source, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs"
              >
                <span className="font-medium">{source.table}</span>
                <ArrowRight className="w-3 h-3" />
                <code className="font-mono">{source.column}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explanation */}
      {transformationType && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-600">
            {transformationType === 'direct' && 'This column is passed through directly from the source without transformation.'}
            {transformationType === 'calculated' && 'This column is computed using an expression or function.'}
            {transformationType === 'aggregated' && 'This column is aggregated using functions like SUM, COUNT, AVG, etc.'}
            {transformationType === 'joined' && 'This column comes from a JOIN operation between multiple tables.'}
            {transformationType === 'filtered' && 'This column is filtered or transformed based on WHERE conditions.'}
          </p>
        </div>
      )}
    </div>
  );
};
