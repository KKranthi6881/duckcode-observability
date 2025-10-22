import { useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeTypes,
  MarkerType,
  BackgroundVariant,
  Position
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { supabase } from '../../config/supabaseClient';
import { Loader2, AlertCircle, Database } from 'lucide-react';
import ModernModelNode from './ModernModelNode';

interface CodeLineageViewProps {
  connectionId: string;
  fileName?: string;
  filePath?: string;
}

interface LineageNode {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface LineageEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

const nodeTypes: NodeTypes = {
  expandableModel: ModernModelNode,
};

const defaultEdgeOptions = {
  type: 'default' as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' },
  style: { stroke: '#cbd5e1', strokeWidth: 2 }
};

// Layout with dagre - same as FocusedLineageView with better spacing
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: 'LR', 
    ranksep: 250,  // More horizontal space between levels
    nodesep: 100,  // More vertical space between nodes
    edgesep: 50    // Space between edges
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 320, height: 120 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = Position.Left;
    node.sourcePosition = Position.Right;
    node.position = {
      x: nodeWithPosition.x - 150,
      y: nodeWithPosition.y - 50,
    };
  });

  return { nodes, edges };
};

export function CodeLineageView({ connectionId, fileName, filePath }: CodeLineageViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Handle node expansion
  const handleExpand = (nodeId: string) => {
    setExpandedNodes(prev => new Set([...prev, nodeId]));
    setNodes(nodes => 
      nodes.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, expanded: true } }
          : node
      )
    );
  };

  const handleCollapse = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
    setNodes(nodes => 
      nodes.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, expanded: false } }
          : node
      )
    );
  };

  // Extract model name from file path (e.g., "models/customers.sql" -> "customers")
  const getModelName = () => {
    if (!fileName && !filePath) return null;
    const name = fileName || filePath?.split('/').pop() || '';
    return name.replace(/\.(sql|py|yml|yaml)$/i, '');
  };

  useEffect(() => {
    fetchModelLineage();
  }, [connectionId, fileName, filePath]);

  const fetchModelLineage = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to view lineage');
        setLoading(false);
        return;
      }

      // First, get all models to find the ID of the current file
      const modelName = getModelName();
      
      // Fetch all models
      const allModelsResponse = await fetch(
        `http://localhost:3001/api/metadata/lineage/model/${connectionId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!allModelsResponse.ok) {
        throw new Error(`Failed to fetch models: ${allModelsResponse.statusText}`);
      }

      const allModelsData = await allModelsResponse.json();
      const { nodes: allNodes } = allModelsData;

      // Find the model ID for the current file
      const currentModel = modelName 
        ? allNodes.find((n: LineageNode) => n.name.toLowerCase() === modelName.toLowerCase())
        : null;

      if (!currentModel && modelName) {
        // If we have a file but can't find the model, show all lineage
        console.warn(`Model not found for file: ${modelName}`);
      }

      let apiNodes, apiEdges;

      if (currentModel) {
        // Fetch focused lineage for this specific model
        const focusedResponse = await fetch(
          `http://localhost:3001/api/metadata/lineage/focused/${connectionId}/${currentModel.id}?upstreamLimit=10&downstreamLimit=10`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!focusedResponse.ok) {
          throw new Error(`Failed to fetch focused lineage: ${focusedResponse.statusText}`);
        }

        const focusedData = await focusedResponse.json();
        apiNodes = focusedData.nodes;
        apiEdges = focusedData.edges;
        setModelId(currentModel.id);
      } else {
        // Show all lineage if no specific file
        apiNodes = allModelsData.nodes;
        apiEdges = allModelsData.edges;
      }

      // Convert to ReactFlow format with ModernModelNode
      const flowNodes: Node[] = await Promise.all(apiNodes.map(async (node: any) => {
        // Fetch columns for each model
        let columns = [];
        try {
          const columnsResponse = await fetch(
            `http://localhost:3001/api/metadata/lineage/columns/${node.id}?limit=100`,
            {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (columnsResponse.ok) {
            const columnsData = await columnsResponse.json();
            columns = columnsData.columns || [];
          }
        } catch (err) {
          console.warn(`Failed to fetch columns for ${node.name}:`, err);
        }

        // Calculate upstream/downstream counts
        const upstreamCount = apiEdges.filter((e: any) => e.target === node.id).length;
        const downstreamCount = apiEdges.filter((e: any) => e.source === node.id).length;
        const isFocal = currentModel && node.id === currentModel.id;

        return {
          id: node.id,
          type: 'expandableModel',
          data: { 
            id: node.id,
            name: node.name,  // Model name (e.g., "customers")
            label: node.name,
            type: node.type || 'model',  // Object type (e.g., "table in model")
            description: node.description,
            filePath: node.filePath,
            updatedAt: node.updatedAt,
            extractionTier: node.extractionTier,
            extractedFrom: node.extractedFrom,
            confidence: node.confidence,
            metadata: node.metadata,
            upstreamCount,
            downstreamCount,
            isFocal,
            expanded: false,
            loading: false,
            onExpand: handleExpand,
            onCollapse: handleCollapse,
            columns: columns.map((col: any) => ({
              id: col.id || col.name,
              name: col.name,
              type: col.data_type || col.type || 'string',
              data_type: col.data_type || col.type || 'string'
            }))
          },
          position: { x: 0, y: 0 }
        };
      }));

      const flowEdges: Edge[] = apiEdges.map((edge: LineageEdge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        ...defaultEdgeOptions
      }));

      // Apply dagre layout
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);
      
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (err: any) {
      console.error('Error fetching model lineage:', err);
      setError(err.response?.data?.error || 'Failed to load lineage data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading code lineage...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Lineage</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Lineage Data</h3>
          <p className="text-gray-600">
            No model dependencies found for this repository. Make sure metadata has been extracted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-right"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
      </ReactFlow>
    </div>
  );
}
