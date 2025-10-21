import { useState, useCallback, useMemo } from 'react';
import { Network, Table2, Maximize2 } from 'lucide-react';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import LineageGraph from './LineageGraph';
import LineageTable from './LineageTable';
import LineageExport from './LineageExport';
import LineageSearch from './LineageSearch';
import LineageFilters, { FilterOptions } from './LineageFilters';

interface LineageViewContainerProps {
  connectionId: string;
  connectionName: string;
}

type ViewMode = 'graph' | 'table';

function LineageViewContent({ connectionId, connectionName }: LineageViewContainerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [columnLineages, setColumnLineages] = useState<any[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    confidenceThreshold: 0,
    modelTypes: [],
    showOnlyConnected: false,
    maxDepth: 0
  });
  const reactFlowInstance = useReactFlow();

  // Apply filters to nodes and edges
  const filteredData = useMemo(() => {
    let filteredNodes = [...nodes];
    let filteredEdges = [...edges];
    let filteredLineages = [...columnLineages];

    // Filter by model type
    if (filters.modelTypes.length > 0) {
      filteredNodes = filteredNodes.filter(node => 
        filters.modelTypes.includes(node.data.type)
      );
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = filteredEdges.filter(edge => 
        nodeIds.has(edge.source) && nodeIds.has(edge.target)
      );
    }

    // Filter by confidence threshold
    if (filters.confidenceThreshold > 0) {
      const threshold = filters.confidenceThreshold / 100;
      filteredLineages = filteredLineages.filter(lineage => 
        lineage.confidence >= threshold
      );
      
      // Filter edges based on column lineage confidence
      const validEdges = new Set<string>();
      filteredLineages.forEach(lineage => {
        validEdges.add(`${lineage.source_object_id}-${lineage.target_object_id}`);
      });
      filteredEdges = filteredEdges.filter(edge => 
        validEdges.has(`${edge.source}-${edge.target}`)
      );
    }

    // Filter only connected nodes
    if (filters.showOnlyConnected) {
      const connectedNodeIds = new Set<string>();
      filteredEdges.forEach(edge => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      });
      filteredNodes = filteredNodes.filter(node => connectedNodeIds.has(node.id));
    }

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      columnLineages: filteredLineages
    };
  }, [nodes, edges, columnLineages, filters]);

  // Handle node focus from search or table
  const handleFocusNode = useCallback((nodeId: string) => {
    if (reactFlowInstance) {
      const node = reactFlowInstance.getNode(nodeId);
      if (node) {
        reactFlowInstance.setCenter(
          node.position.x + (node.width || 0) / 2,
          node.position.y + (node.height || 0) / 2,
          { zoom: 1.5, duration: 800 }
        );
      }
    }
  }, [reactFlowInstance]);

  // Handle fit view
  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
    }
  }, [reactFlowInstance]);

  // Receive data updates from LineageGraph
  const handleDataUpdate = useCallback((data: {
    nodes: any[];
    edges: any[];
    columnLineages: any[];
  }) => {
    setNodes(data.nodes);
    setEdges(data.edges);
    setColumnLineages(data.columnLineages);
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* Header with controls */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Data Lineage
            </h2>

            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'graph'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Network className="w-4 h-4" />
                Graph View
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Table2 className="w-4 h-4" />
                Table View
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search (only in graph view) */}
            {viewMode === 'graph' && (
              <LineageSearch
                nodes={filteredData.nodes}
                onNodeSelect={handleFocusNode}
                onClear={handleFitView}
              />
            )}

            {/* Filters */}
            <LineageFilters
              onFilterChange={setFilters}
              totalNodes={nodes.length}
              filteredNodes={filteredData.nodes.length}
            />

            {/* Fit View (only in graph view) */}
            {viewMode === 'graph' && (
              <button
                onClick={handleFitView}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                title="Fit to view"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}

            {/* Export */}
            <LineageExport
              nodes={filteredData.nodes}
              edges={filteredData.edges}
              connectionName={connectionName}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'graph' ? (
          <LineageGraph
            connectionId={connectionId}
            onDataUpdate={handleDataUpdate}
          />
        ) : (
          <LineageTable
            nodes={filteredData.nodes}
            edges={filteredData.edges}
            columnLineages={filteredData.columnLineages}
            onFocusNode={(nodeId) => {
              setViewMode('graph');
              setTimeout(() => handleFocusNode(nodeId), 100);
            }}
            onSwitchToGraph={() => setViewMode('graph')}
          />
        )}
      </div>
    </div>
  );
}

export default function LineageViewContainer(props: LineageViewContainerProps) {
  return (
    <ReactFlowProvider>
      <LineageViewContent {...props} />
    </ReactFlowProvider>
  );
}
