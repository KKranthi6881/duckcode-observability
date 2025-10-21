import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

interface ColumnLineage {
  id: string;
  source_column: string;
  source_object_id: string;
  target_column: string;
  transformation_type: string;
  confidence: number;
}

interface Column {
  id: string;
  name: string;
  data_type: string;
  lineages?: ColumnLineage[];
}

interface ModelNodeData {
  id: string;
  name: string;
  type: string;
  stats: {
    upstreamCount: number;
    downstreamCount: number;
  };
  columns?: Column[];
  expanded?: boolean;
  onExpand?: (nodeId: string) => void;
  onCollapse?: (nodeId: string) => void;
  loading?: boolean;
  showingColumns?: number;
}

const INITIAL_COLUMNS_SHOWN = 7;

function ExpandableModelNode({ data }: NodeProps<ModelNodeData>) {
  const [showingMore, setShowingMore] = useState(false);
  
  const columns = data.columns || [];
  const visibleColumns = showingMore ? columns : columns.slice(0, INITIAL_COLUMNS_SHOWN);
  const hasMore = columns.length > INITIAL_COLUMNS_SHOWN;

  const handleToggle = useCallback(() => {
    if (data.expanded) {
      data.onCollapse?.(data.id);
    } else {
      data.onExpand?.(data.id);
    }
  }, [data]);

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.95) return { color: 'bg-green-500', label: 'GOLD' };
    if (confidence >= 0.90) return { color: 'bg-blue-500', label: 'SILVER' };
    if (confidence >= 0.85) return { color: 'bg-orange-500', label: 'BRONZE' };
    return { color: 'bg-red-500', label: 'LOW' };
  };

  return (
    <div className="bg-white border-2 border-blue-500 rounded-lg shadow-lg min-w-[280px]">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500" />
      
      {/* Model Header */}
      <div
        className="p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {data.expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
            <div>
              <div className="font-semibold text-sm text-gray-900">{data.name}</div>
              <div className="text-xs text-gray-500">{data.type}</div>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            ↑{data.stats.upstreamCount} ↓{data.stats.downstreamCount}
          </div>
        </div>
      </div>

      {/* Expanded Columns */}
      {data.expanded && (
        <div className="p-3">
          {data.loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-gray-600">Loading columns...</span>
            </div>
          ) : columns.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-2">
              No columns found
            </div>
          ) : (
            <>
              <div className="text-xs font-medium text-gray-700 mb-2">
                Columns ({columns.length}):
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {visibleColumns.map((column) => {
                  const hasLineage = column.lineages && column.lineages.length > 0;
                  const avgConfidence = hasLineage
                    ? column.lineages!.reduce((sum, l) => sum + l.confidence, 0) / column.lineages!.length
                    : 0;
                  const badge = hasLineage ? getConfidenceBadge(avgConfidence) : null;

                  return (
                    <div
                      key={column.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-50 border border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-800 truncate">
                          {column.name}
                        </div>
                        <div className="text-xs text-gray-500">{column.data_type}</div>
                      </div>
                      {hasLineage && badge && (
                        <div className="flex items-center gap-1">
                          <Handle
                            type="target"
                            position={Position.Left}
                            id={`${data.id}-${column.name}-target`}
                            className="w-2 h-2 bg-blue-500"
                            style={{ position: 'absolute', left: '-4px', top: '50%', transform: 'translateY(-50%)' }}
                          />
                          <div className={`${badge.color} text-white text-xs px-1.5 py-0.5 rounded font-medium`}>
                            {Math.round(avgConfidence * 100)}%
                          </div>
                          <Handle
                            type="source"
                            position={Position.Right}
                            id={`${data.id}-${column.name}-source`}
                            className="w-2 h-2 bg-green-500"
                            style={{ position: 'absolute', right: '-4px', top: '50%', transform: 'translateY(-50%)' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Show More Button */}
              {hasMore && !showingMore && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowingMore(true);
                  }}
                  className="w-full mt-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
                >
                  + Show {columns.length - INITIAL_COLUMNS_SHOWN} more columns
                </button>
              )}
              
              {showingMore && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowingMore(false);
                  }}
                  className="w-full mt-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded border border-gray-200 transition-colors"
                >
                  Show less
                </button>
              )}
            </>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500" />
    </div>
  );
}

export default memo(ExpandableModelNode);
