import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ChevronDown, Loader2, Database, Table2, FileText, Focus, Cloud, GitBranch, Wind, BarChart3 } from 'lucide-react';

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
  source?: 'dbt' | 'snowflake' | string; // Primary source type for unified lineage
  sources?: string[]; // All sources if object exists in multiple systems
  schema?: string;
  database?: string;
  fqn?: string;
  description?: string;
  filePath?: string;
  updatedAt?: string;
  extractionTier?: string;
  extractedFrom?: string;
  confidence?: number;
  metadata?: any;
  upstreamCount?: number;
  downstreamCount?: number;
  stats?: {
    upstreamCount: number;
    downstreamCount: number;
  };
  columns?: Column[];
  expanded?: boolean;
  onExpand?: (nodeId: string) => void;
  onCollapse?: (nodeId: string) => void;
  onNodeClick?: (nodeId: string) => void;
  loading?: boolean;
  isFocal?: boolean;
  onColumnHover?: (columnId: string | null, lineages: ColumnLineage[]) => void;
  tooltipContainer?: HTMLElement | null;
  hasDocumentation?: boolean;
  onViewDocumentation?: (nodeId: string, nodeName: string) => void;
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
        bg-[#161413] rounded-lg transition-all duration-200 min-w-[240px] max-w-[280px] relative
        ${data.isFocal ? 'border-2 border-[#ff6a3c]' : 'border-2 border-[#2d2a27] hover:border-[#ff6a3c]/50'}
      `}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 !bg-blue-500 border-2 border-white"
      />
      
      {/* Model Header */}
      <div
        className="p-2.5 cursor-pointer transition-all duration-200 hover:bg-[#1f1d1b] rounded-t-lg border-b border-[#2d2a27]"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          {/* Icon */}
          <div className={`${typeConfig.bgColor} p-1.5 rounded-md flex items-center justify-center`}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="font-semibold text-xs text-white truncate">
                {data.name}
              </div>
              {/* Source Type Badge with Icon(s) - Shows multiple sources if available */}
              {(data.sources && data.sources.length > 0 ? data.sources : data.source ? [data.source] : []).length > 0 && (
                <div className="flex-shrink-0 flex items-center gap-1">
                  {(data.sources && data.sources.length > 0 ? data.sources : [data.source!]).map((src, idx) => {
                    const source = String(src || '').toLowerCase();
                    const classes =
                      source === 'snowflake'
                        ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                        : source === 'dbt' || source === 'github'
                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                        : source === 'airflow'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : source === 'tableau'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : source === 'power_bi'
                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        : 'bg-gray-600/20 border border-gray-600/30 text-gray-400';

                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${classes}`}
                        title={`Source: ${source.toUpperCase()}`}
                      >
                        {source === 'snowflake' && <Cloud className="w-3 h-3" />}
                        {(source === 'dbt' || source === 'github') && <GitBranch className="w-3 h-3" />}
                        {source === 'airflow' && <Wind className="w-3 h-3" />}
                        {(source === 'tableau' || source === 'power_bi') && <BarChart3 className="w-3 h-3" />}
                        {!['snowflake', 'dbt', 'github', 'airflow', 'tableau', 'power_bi'].includes(source) && (
                          <Database className="w-3 h-3" />
                        )}
                        <span className="text-[9px]">{source.toUpperCase()}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {data.isFocal && (
                <div className="flex-shrink-0 bg-[#ff6a3c] text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                  ✓
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8d857b] flex items-center gap-1">
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
          
          {/* Action Buttons */}
          <div className="flex flex-col items-end gap-1">
            {data.hasDocumentation && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  data.onViewDocumentation?.(data.id, data.name);
                }}
                className="text-purple-600 text-xs font-medium hover:text-purple-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-50 transition-colors"
                title="View AI Documentation"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Docs</span>
              </button>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                data.onNodeClick?.(data.id);
              }}
              className="text-green-600 text-xs font-medium hover:text-green-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-green-50 transition-colors"
              title="Center view and highlight connections"
            >
              <Focus className="w-3.5 h-3.5" />
              <span>Focus</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Columns */}
      {data.expanded && (
        <div className="p-2.5">
          {data.loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="ml-2 text-xs text-[#8d857b] font-medium">Loading columns...</span>
            </div>
          ) : columns.length === 0 ? (
            <div className="text-xs text-[#8d857b] text-center py-3 font-medium">
              No columns found
            </div>
          ) : (
            <>
              <div className="mb-2">
                <div className="text-[10px] font-semibold text-[#8d857b] mb-1.5">
                  {columns.length} columns
                </div>
              </div>
              
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {visibleColumns.map((column) => {
                  const lineageType = getColumnLineageType(column);
                  const isHovered = hoveredColumn === column.id;
                  
                  return (
                    <div
                      key={column.id}
                      onMouseEnter={() => handleColumnHover(column.id, column.lineages || [])}
                      onMouseLeave={() => handleColumnHover(null)}
                      className={`
                        relative p-1.5 rounded border transition-all duration-200 cursor-pointer
                        ${isHovered 
                          ? 'bg-[#1f1d1b] border-[#ff6a3c]/50' 
                          : 'bg-[#0d0c0c] border-[#2d2a27] hover:border-[#2d2a27]'
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
                            <span className="text-[#8d857b] text-sm">A</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white truncate">
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
                      className="w-full py-2.5 text-xs font-bold text-white hover:text-[#ff6a3c] bg-[#1f1d1b] hover:bg-[#2d2a27] rounded-lg border-2 border-[#2d2a27] hover:border-[#ff6a3c]/50 transition-all flex items-center justify-center gap-2"
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
