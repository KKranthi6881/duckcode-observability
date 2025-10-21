import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ChevronDown, Loader2, Database, Table2, FileText } from 'lucide-react';

interface ColumnLineage {
  id: string;
  source_column: string;
  source_object_id: string;
  target_column: string;
  target_object_id: string;
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
  isFocal?: boolean;
  onColumnHover?: (columnId: string | null, lineages: ColumnLineage[]) => void;
}

const INITIAL_COLUMNS_SHOWN = 5;

// Get icon and color based on model type - minimal and clean
const getTypeConfig = (type: string) => {
  const lowerType = type.toLowerCase();
  
  if (lowerType.includes('source') || lowerType.includes('seed')) {
    return {
      icon: Database,
      bgColor: 'bg-indigo-600',
      borderColor: 'border-indigo-200',
      badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200'
    };
  }
  
  if (lowerType.includes('staging') || lowerType.includes('stg')) {
    return {
      icon: Table2,
      bgColor: 'bg-blue-600',
      borderColor: 'border-blue-200',
      badge: 'bg-blue-50 text-blue-700 border border-blue-200'
    };
  }
  
  return {
    icon: FileText,
    bgColor: 'bg-teal-600',
    borderColor: 'border-teal-200',
    badge: 'bg-teal-50 text-teal-700 border border-teal-200'
  };
};

function ModernModelNode({ data }: NodeProps<ModelNodeData>) {
  const [showingMore, setShowingMore] = useState(false);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  
  const columns = data.columns || [];
  const visibleColumns = showingMore ? columns : columns.slice(0, INITIAL_COLUMNS_SHOWN);
  const hasMore = columns.length > INITIAL_COLUMNS_SHOWN;
  
  const typeConfig = getTypeConfig(data.type);
  const Icon = typeConfig.icon;

  const handleToggle = useCallback(() => {
    if (data.expanded) {
      data.onCollapse?.(data.id);
    } else {
      data.onExpand?.(data.id);
    }
  }, [data]);

  const handleColumnHover = useCallback((columnId: string | null, lineages: ColumnLineage[] = []) => {
    setHoveredColumn(columnId);
    data.onColumnHover?.(columnId, lineages);
  }, [data]);

  // Calculate if column has incoming/outgoing lineage
  const getColumnLineageType = (column: Column) => {
    if (!column.lineages || column.lineages.length === 0) return null;
    
    const hasIncoming = column.lineages.some(l => l.target_object_id === data.id);
    const hasOutgoing = column.lineages.some(l => l.source_object_id === data.id);
    
    return { hasIncoming, hasOutgoing, count: column.lineages.length };
  };

  return (
    <div
      className={`
        bg-white rounded-lg transition-all duration-200 min-w-[320px] max-w-[400px]
        ${data.isFocal ? 'shadow-lg border-2 border-blue-400' : 'shadow-md hover:shadow-lg border-2 border-gray-200'}
      `}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 !bg-blue-500 border-2 border-white"
      />
      
      {/* Model Header */}
      <div
        className="p-4 cursor-pointer transition-all duration-200 hover:bg-gray-50 rounded-t-lg border-b border-gray-200"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`${typeConfig.bgColor} p-2 rounded-md flex items-center justify-center`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="font-semibold text-sm text-gray-900 truncate">
                {data.name}
              </div>
              {data.isFocal && (
                <div className="flex-shrink-0 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                  ✓
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <Database className="w-3 h-3" />
                <span className="font-medium">Table in {data.type.replace('_', ' ')}</span>
              </span>
            </div>
            {columns.length > 0 && (
              <div className="text-[11px] text-blue-600 font-medium mt-1">
                {columns.length} columns {data.expanded ? '▼' : '▶'}
              </div>
            )}
          </div>
          
          {/* Explore Button */}
          <div className="flex flex-col items-end gap-1">
            <button className="text-blue-600 text-xs font-medium hover:text-blue-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-colors">
              <span>Explore</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Columns */}
      {data.expanded && (
        <div className="p-4">
          {data.loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-3 text-sm text-gray-600 font-medium">Loading columns...</span>
            </div>
          ) : columns.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4 font-medium">
              No columns found
            </div>
          ) : (
            <>
              <div className="mb-3">
                <div className="text-xs font-semibold text-gray-600 mb-2">
                  {columns.length} columns
                </div>
              </div>
              
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {visibleColumns.map((column) => {
                  const lineageType = getColumnLineageType(column);
                  const isHovered = hoveredColumn === column.id;
                  
                  return (
                    <div
                      key={column.id}
                      onMouseEnter={() => handleColumnHover(column.id, column.lineages || [])}
                      onMouseLeave={() => handleColumnHover(null)}
                      className={`
                        relative p-2.5 rounded border transition-all duration-200 cursor-pointer
                        ${isHovered 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'bg-white border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      {/* Connection Indicators - Clean and minimal */}
                      {lineageType && lineageType.hasIncoming && (
                        <Handle
                          type="target"
                          position={Position.Left}
                          id={`${data.id}-${column.name}-target`}
                          className={`
                            w-2 h-2 !bg-blue-500 border border-white
                            ${isHovered ? 'scale-125' : ''}
                            transition-all duration-200
                          `}
                          style={{ 
                            position: 'absolute', 
                            left: '-5px', 
                            top: '50%', 
                            transform: 'translateY(-50%)' 
                          }}
                        />
                      )}
                      
                      {lineageType && lineageType.hasOutgoing && (
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={`${data.id}-${column.name}-source`}
                          className={`
                            w-2 h-2 !bg-blue-500 border border-white
                            ${isHovered ? 'scale-125' : ''}
                            transition-all duration-200
                          `}
                          style={{ 
                            position: 'absolute', 
                            right: '-5px', 
                            top: '50%', 
                            transform: 'translateY(-50%)' 
                          }}
                        />
                      )}
                      
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {lineageType ? (
                            <span className="text-yellow-500 text-sm">🔑</span>
                          ) : (
                            <span className="text-gray-400 text-sm">A</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {column.name}
                          </div>
                        </div>
                      </div>
                      
                    </div>
                  );
                })}
              </div>

              {/* Show More/Less Buttons */}
              {hasMore && (
                <div className="mt-4 pt-3 border-t-2 border-gray-200">
                  {!showingMore ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowingMore(true);
                      }}
                      className="w-full py-2.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <ChevronDown className="w-4 h-4" />
                      Show {columns.length - INITIAL_COLUMNS_SHOWN} more columns
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowingMore(false);
                      }}
                      className="w-full py-2.5 text-xs font-bold text-gray-600 hover:text-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-lg border-2 border-gray-300 hover:border-gray-400 transition-all flex items-center justify-center gap-2"
                    >
                      <ChevronDown className="w-4 h-4 rotate-180" />
                      Show less
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-blue-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(ModernModelNode);
