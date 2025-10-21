import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { supabase } from '../../config/supabaseClient';
import { Loader2, AlertCircle } from 'lucide-react';

interface LineageData {
  nodes: any[];
  edges: any[];
  metadata: {
    connectionId: string;
    totalModels: number;
    totalDependencies: number;
  };
}

// Layout algorithm using dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  const nodeWidth = 250;
  const nodeHeight = 120;

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = direction === 'LR' ? 'left' as any : 'top' as any;
    node.sourcePosition = direction === 'LR' ? 'right' as any : 'bottom' as any;

    // Shift to center
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

export default function LineagePage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lineageData, setLineageData] = useState<LineageData | null>(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Fetch lineage data
  useEffect(() => {
    async function fetchLineage() {
      if (!connectionId) return;

      try {
        setLoading(true);
        setError(null);

        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Not authenticated');
          return;
        }

        // Fetch lineage from API
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/metadata/lineage/model/${connectionId}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch lineage');
        }

        const data: LineageData = await response.json();
        setLineageData(data);

        // Transform to ReactFlow format
        const flowNodes: Node[] = data.nodes.map((node) => ({
          id: node.id,
          type: 'default',
          data: {
            label: (
              <div className="p-4">
                <div className="font-semibold text-lg">{node.name}</div>
                <div className="text-sm text-gray-500 mt-1">{node.type}</div>
                <div className="text-xs text-gray-400 mt-2">
                  ↑ {node.stats.upstreamCount} | ↓ {node.stats.downstreamCount}
                </div>
              </div>
            )
          },
          position: { x: 0, y: 0 }, // Will be set by dagre
          style: {
            background: '#ffffff',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            width: 250
          }
        }));

        const flowEdges: Edge[] = data.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep',
          animated: true,
          style: {
            stroke: '#10b981',
            strokeWidth: 2
          },
          label: `${Math.round(edge.confidence * 100)}%`,
          labelStyle: {
            fill: '#10b981',
            fontWeight: 600,
            fontSize: 12
          }
        }));

        // Apply layout
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          flowNodes,
          flowEdges
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

      } catch (err: any) {
        console.error('Error fetching lineage:', err);
        setError(err.message || 'Failed to load lineage');
      } finally {
        setLoading(false);
      }
    }

    fetchLineage();
  }, [connectionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-lg">Loading lineage...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <span className="ml-3 text-lg text-red-600">{error}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Data Lineage</h1>
        {lineageData && (
          <p className="text-sm text-gray-600 mt-1">
            {lineageData.metadata.totalModels} models · {lineageData.metadata.totalDependencies} dependencies
          </p>
        )}
      </div>

      {/* Graph */}
      <div className="w-full h-[calc(100vh-80px)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          attributionPosition="bottom-left"
        >
          <Controls />
          <MiniMap
            nodeColor={() => '#3b82f6'}
            style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb'
            }}
          />
          <Background gap={16} size={1} color="#e5e7eb" />
        </ReactFlow>
      </div>
    </div>
  );
}
