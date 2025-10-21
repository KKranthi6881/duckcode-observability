import { memo, useState, useRef, useEffect } from 'react';
import { X, ArrowRight, Search } from 'lucide-react';

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

interface ColumnLineageViewProps {
  sourceModel: {
    id: string;
    name: string;
    columns: Column[];
  };
  targetModel: {
    id: string;
    name: string;
    columns: Column[];
  };
  lineages: ColumnLineage[];
  onClose: () => void;
}

interface ColumnPosition {
  id: string;
  name: string;
  x: number;
  y: number;
  type: 'source' | 'target';
}

function ColumnLineageView({ sourceModel, targetModel, lineages, onClose }: ColumnLineageViewProps) {
  const [hoveredLineage, setHoveredLineage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const sourceRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const [columnPositions, setColumnPositions] = useState<ColumnPosition[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate column positions for SVG lines
  useEffect(() => {
    if (!sourceRef.current || !targetRef.current || !containerRef.current) return;

    const positions: ColumnPosition[] = [];
    const containerRect = containerRef.current.getBoundingClientRect();

    // Get source column positions
    const sourceElements = sourceRef.current.querySelectorAll('[data-column-id]');
    sourceElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const id = el.getAttribute('data-column-id');
      const name = el.getAttribute('data-column-name');
      if (id && name) {
        positions.push({
          id,
          name,
          x: rect.right - containerRect.left,
          y: rect.top + rect.height / 2 - containerRect.top,
          type: 'source'
        });
      }
    });

    // Get target column positions
    const targetElements = targetRef.current.querySelectorAll('[data-column-id]');
    targetElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const id = el.getAttribute('data-column-id');
      const name = el.getAttribute('data-column-name');
      if (id && name) {
        positions.push({
          id,
          name,
          x: rect.left - containerRect.left,
          y: rect.top + rect.height / 2 - containerRect.top,
          type: 'target'
        });
      }
    });

    setColumnPositions(positions);
  }, [sourceModel.columns, targetModel.columns, lineages]);

  // Generate SVG path for curved line
  const generateCurvePath = (sourcePos: ColumnPosition, targetPos: ColumnPosition): string => {
    const startX = sourcePos.x;
    const startY = sourcePos.y;
    const endX = targetPos.x;
    const endY = targetPos.y;

    // Control points for smooth bezier curve
    const midX = (startX + endX) / 2;
    
    return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
  };

  // Filter columns based on search
  const filteredSourceColumns = searchTerm
    ? sourceModel.columns.filter(col => 
        col.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        col.data_type.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : sourceModel.columns;

  const filteredTargetColumns = searchTerm
    ? targetModel.columns.filter(col =>
        col.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        col.data_type.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : targetModel.columns;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-white px-3 py-1.5 rounded-lg border border-blue-200 font-semibold text-sm text-gray-900">
                {sourceModel.name}
              </div>
              <ArrowRight className="w-5 h-5 text-blue-600" />
              <div className="bg-white px-3 py-1.5 rounded-lg border border-blue-200 font-semibold text-sm text-gray-900">
                {targetModel.name}
              </div>
              <div className="ml-2 bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full font-bold">
                {lineages.length} {lineages.length === 1 ? 'connection' : 'connections'}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search columns..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Main Content */}
        <div
          className="flex-1 overflow-hidden relative bg-[radial-gradient(circle_at_1px_1px,_#e5e7eb_1px,_transparent_1px)] [background-size:16px_16px]"
          ref={containerRef}
        >
          <div className="h-full flex">
            {/* Source Columns */}
            <div className="w-1/2 border-r bg-white overflow-y-auto p-6" ref={sourceRef}>
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Source Columns
                </div>
                <div className="text-xs text-gray-600">
                  {filteredSourceColumns.length} of {sourceModel.columns.length}
                </div>
              </div>
              <div className="space-y-2">
                {filteredSourceColumns.map((column) => {
                  const hasLineage = lineages.some(l => l.source_column === column.name);
                  const relatedLineages = lineages.filter(l => l.source_column === column.name);
                  const isHovered = relatedLineages.some(l => l.id === hoveredLineage);

                  return (
                    <div
                      key={column.id}
                      data-column-id={column.id}
                      data-column-name={column.name}
                      onMouseEnter={() => relatedLineages.length > 0 && setHoveredLineage(relatedLineages[0].id)}
                      onMouseLeave={() => setHoveredLineage(null)}
                      className={`
                        p-3 rounded-xl border transition-all duration-200 cursor-pointer
                        ${isHovered 
                          ? 'bg-blue-50 border-blue-400 shadow-md scale-[1.015]' 
                          : hasLineage
                            ? 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                            : 'bg-gray-50 border-gray-100'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {column.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                              {column.data_type}
                            </span>
                          </div>
                        </div>
                        {hasLineage && (
                          <div className="ml-2 w-2 h-2 rounded-full bg-blue-500"></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Target Columns */}
            <div className="w-1/2 bg-white overflow-y-auto p-6" ref={targetRef}>
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Target Columns
                </div>
                <div className="text-xs text-gray-600">
                  {filteredTargetColumns.length} of {targetModel.columns.length}
                </div>
              </div>
              <div className="space-y-2">
                {filteredTargetColumns.map((column) => {
                  const hasLineage = lineages.some(l => l.target_column === column.name);
                  const relatedLineages = lineages.filter(l => l.target_column === column.name);
                  const isHovered = relatedLineages.some(l => l.id === hoveredLineage);

                  return (
                    <div
                      key={column.id}
                      data-column-id={column.id}
                      data-column-name={column.name}
                      onMouseEnter={() => relatedLineages.length > 0 && setHoveredLineage(relatedLineages[0].id)}
                      onMouseLeave={() => setHoveredLineage(null)}
                      className={`
                        p-3 rounded-lg border transition-all duration-200 cursor-pointer
                        ${isHovered 
                          ? 'bg-blue-50 border-blue-400 shadow-sm scale-105' 
                          : hasLineage
                            ? 'bg-white border-gray-200 hover:border-blue-300'
                            : 'bg-gray-50 border-gray-100'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        {hasLineage && (
                          <div className="mr-2 w-2 h-2 rounded-full bg-blue-500"></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {column.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                              {column.data_type}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SVG Overlay for Lines */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: '100%', height: '100%' }}
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                </marker>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#94a3b8" floodOpacity="0.15" />
                </filter>
              </defs>
              {lineages.map((lineage) => {
                const sourcePos = columnPositions.find(
                  p => p.name === lineage.source_column && p.type === 'source'
                );
                const targetPos = columnPositions.find(
                  p => p.name === lineage.target_column && p.type === 'target'
                );

                if (!sourcePos || !targetPos) return null;

                const isHovered = hoveredLineage === lineage.id;
                const path = generateCurvePath(sourcePos, targetPos);

                return (
                  <g key={lineage.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke={isHovered ? '#3b82f6' : '#94a3b8'}
                      strokeWidth={isHovered ? 3 : 2}
                      opacity={isHovered ? 1 : 0.7}
                      className="transition-all duration-200"
                      strokeLinecap="round"
                      markerEnd="url(#arrow)"
                      filter="url(#shadow)"
                    />
                    {isHovered && (
                      <circle
                        cx={(sourcePos.x + targetPos.x) / 2}
                        cy={(sourcePos.y + targetPos.y) / 2}
                        r="12"
                        fill="#3b82f6"
                        className="animate-pulse"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-600">
          <div>
            Hover over columns to highlight connections
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>Has lineage</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-500"></div>
              <span>Connection</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ColumnLineageView);
