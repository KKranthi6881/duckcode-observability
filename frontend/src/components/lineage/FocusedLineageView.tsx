import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeTypes,
  MarkerType
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { supabase } from '../../config/supabaseClient';
import { Loader2, AlertCircle, Target, RefreshCw } from 'lucide-react';
import ExpandableModelNode from './ExpandableModelNode';
import ModelSelector from './ModelSelector';

interface FocusedLineageViewProps {
  connectionId: string;
  onDataUpdate?: (data: { nodes: Node[]; edges: Edge[]; columnLineages: any[] }) => void;
}

const nodeTypes: NodeTypes = {
  expandableModel: ExpandableModelNode,
};

// Layout with dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', ranksep: 200, nodesep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 300, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 150,
      y: nodeWithPosition.y - 50,
    };
  });

  return { nodes, edges };
};

export default function FocusedLineageView({ connectionId, onDataUpdate }: FocusedLineageViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedModelName, setSelectedModelName] = useState<string>('');
  const [allColumnLineages, setAllColumnLineages] = useState<any[]>([]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Fetch columns for a model
  const fetchColumns = useCallback(async (nodeId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/metadata/lineage/columns/${nodeId}?limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        const columnsWithLineages = data.columns.map((column: any) => {
          const columnLineages = data.columnLineages.filter((lineage: any) => 
            (lineage.source_object_id === nodeId && lineage.source_column === column.name) ||
            (lineage.target_object_id === nodeId && lineage.target_column === column.name)
          );
          
          return { ...column, lineages: columnLineages };
        });
        
        if (data.columnLineages && data.columnLineages.length > 0) {
          setAllColumnLineages(prev => [...prev, ...data.columnLineages]);
        }
        
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    columns: columnsWithLineages,
                    expanded: true,
                    loading: false
                  }
                }
              : node
          )
        );
      }
    } catch (err) {
      console.error('Error fetching columns:', err);
    }
  }, [setNodes]);

  const handleExpand = useCallback((nodeId: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, loading: true } }
          : node
      )
    );
    fetchColumns(nodeId);
  }, [fetchColumns, setNodes]);

  const handleCollapse = useCallback((nodeId: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, expanded: false } }
          : node
      )
    );
  }, [setNodes]);

  // Fetch focused lineage
  const fetchFocusedLineage = useCallback(async (modelId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/metadata/lineage/focused/${connectionId}/${modelId}?upstreamLimit=5&downstreamLimit=5`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch focused lineage');
      }

      const data = await response.json();

      if (!data.nodes || data.nodes.length === 0) {
        setError('No lineage data found for this model');
        return;
      }

      // Transform to ReactFlow format
      const flowNodes: Node[] = data.nodes.map((node: any) => ({
        id: node.id,
        type: 'expandableModel',
        data: {
          id: node.id,
          name: node.name,
          type: node.type,
          stats: node.stats,
          expanded: false,
          onExpand: handleExpand,
          onCollapse: handleCollapse,
          loading: false,
          isFocal: node.isFocal
        },
        position: { x: 0, y: 0 },
        style: node.isFocal ? {
          border: '4px solid #3b82f6',
          boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)',
          backgroundColor: '#eff6ff'
        } : {}
      }));

      const flowEdges: Edge[] = data.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: '#10b981',
          strokeWidth: 3
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#10b981'
        },
        label: `${Math.round(edge.confidence * 100)}%`,
        labelStyle: {
          fill: '#10b981',
          fontWeight: 700,
          fontSize: 12
        }
      }));

      // Apply layout
      const layouted = getLayoutedElements(flowNodes, flowEdges);
      setNodes(layouted.nodes);
      setEdges(layouted.edges);

    } catch (err) {
      console.error('[FocusedLineage] Error:', err);
      setError('Failed to load lineage data');
    } finally {
      setLoading(false);
    }
  }, [connectionId, handleExpand, handleCollapse, setNodes, setEdges]);

  // Handle model selection
  const handleModelSelect = useCallback((modelId: string, modelName: string) => {
    setSelectedModel(modelId);
    setSelectedModelName(modelName);
    setAllColumnLineages([]);
    fetchFocusedLineage(modelId);
  }, [fetchFocusedLineage]);

  // Reset view
  const handleReset = () => {
    setSelectedModel(null);
    setSelectedModelName('');
    setNodes([]);
    setEdges([]);
    setError(null);
    setAllColumnLineages([]);
  };

  // Notify parent of data updates
  useEffect(() => {
    if (onDataUpdate && nodes.length > 0) {
      onDataUpdate({
        nodes,
        edges,
        columnLineages: allColumnLineages
      });
    }
  }, [nodes, edges, allColumnLineages, onDataUpdate]);

  // Initial empty state
  if (!selectedModel) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
              <Target className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Explore Data Lineage
            </h2>
            <p className="text-lg text-gray-600">
              Select a model to see its upstream and downstream dependencies
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-blue-200">
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Choose a Starting Model
              </label>
              <ModelSelector
                connectionId={connectionId}
                onModelSelect={handleModelSelect}
                selectedModel={selectedModel || undefined}
              />
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                📊 What you'll see:
              </h3>
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span><strong>5 upstream models</strong> - Where data comes from</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span><strong>Your selected model</strong> - Highlighted in blue</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span><strong>5 downstream models</strong> - Where data goes to</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span><strong>Column-level lineage</strong> - Expand any model to see columns</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-lg">Loading focused lineage...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Select Different Model
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <div>
              <div className="text-sm font-semibold text-gray-900">{selectedModelName}</div>
              <div className="text-xs text-gray-500">
                Showing {nodes.length} models ({nodes.filter(n => n.data.isFocal).length} focal)
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchFocusedLineage(selectedModel)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200"
          >
            Change Model
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Controls />
          <MiniMap
            nodeColor={(node) => node.data.isFocal ? '#3b82f6' : '#10b981'}
            style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb'
            }}
          />
          <Background gap={12} size={1} color="#e5e7eb" />
        </ReactFlow>
      </div>
    </div>
  );
}
