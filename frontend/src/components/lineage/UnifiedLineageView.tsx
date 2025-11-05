import { useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeTypes,
  MarkerType,
  BackgroundVariant,
  Position,
  useReactFlow,
  ReactFlowProvider
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { supabase } from '../../config/supabaseClient';
import { Loader2, AlertCircle, Database, Filter } from 'lucide-react';
import ModernModelNode from './ModernModelNode';

interface UnifiedLineageViewProps {
  organizationId?: string;
}

interface LineageNode {
  id: string;
  name: string;
  schema?: string;
  database?: string;
  type: string;
  source: 'dbt' | 'snowflake' | string;
  fqn?: string;
  description?: string;
  stats?: {
    upstreamCount: number;
    downstreamCount: number;
  };
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

// Layout with dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: 'LR', 
    ranksep: 250,
    nodesep: 100,
    edgesep: 50
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

function UnifiedLineageViewContent({ organizationId }: UnifiedLineageViewProps) {
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'dbt' | 'snowflake'>('all');
  const [stats, setStats] = useState<any>(null);

  const fetchUnifiedLineage = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const url = `${apiUrl}/api/metadata/lineage/unified${sourceFilter !== 'all' ? `?sourceFilter=${sourceFilter}` : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch lineage: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[UnifiedLineage] Received data:', data);

      setStats(data.stats);

      // Convert to ReactFlow format
      const flowNodes: Node[] = (data.nodes || []).map((node: LineageNode) => ({
        id: node.id,
        type: 'expandableModel',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          label: node.name,
          name: node.name,
          schema: node.schema,
          database: node.database,
          type: node.type,
          source: node.source || 'dbt',
          fqn: node.fqn,
          description: node.description,
          upstreamCount: node.stats?.upstreamCount || 0,
          downstreamCount: node.stats?.downstreamCount || 0,
        },
      }));

      const flowEdges: Edge[] = (data.edges || []).map((edge: LineageEdge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'default',
        ...defaultEdgeOptions,
      }));

      // Apply layout
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      // Fit view after a short delay
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
      }, 100);

    } catch (err: any) {
      console.error('[UnifiedLineage] Error:', err);
      setError(err.message || 'Failed to load lineage');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnifiedLineage();
  }, [sourceFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading unified lineage...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Lineage</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchUnifiedLineage}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {/* Filter Controls */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Source Filter</span>
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as any)}
          className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Sources</option>
          <option value="dbt">dbt Models Only</option>
          <option value="snowflake">Snowflake Tables Only</option>
        </select>

        {/* Stats */}
        {stats && (
          <div className="pt-2 border-t space-y-1 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Total Objects:</span>
              <span className="font-semibold">{stats.total}</span>
            </div>
            <div className="flex justify-between">
              <span>dbt Models:</span>
              <span className="font-semibold text-orange-600">{stats.bySource.dbt}</span>
            </div>
            <div className="flex justify-between">
              <span>Snowflake Tables:</span>
              <span className="font-semibold text-blue-600">{stats.bySource.snowflake}</span>
            </div>
            <div className="flex justify-between">
              <span>Dependencies:</span>
              <span className="font-semibold">{stats.dependencies}</span>
            </div>
            {stats.crossSourceDeps > 0 && (
              <div className="flex justify-between text-indigo-600">
                <span>Cross-Source Links:</span>
                <span className="font-semibold">{stats.crossSourceDeps}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ReactFlow Canvas */}
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
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const source = node.data?.source;
            if (source === 'snowflake') return '#3b82f6'; // Blue
            if (source === 'dbt') return '#f97316'; // Orange
            return '#6b7280'; // Gray
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          style={{ backgroundColor: '#f9fafb' }}
        />
      </ReactFlow>
    </div>
  );
}

export default function UnifiedLineageView(props: UnifiedLineageViewProps) {
  return (
    <ReactFlowProvider>
      <UnifiedLineageViewContent {...props} />
    </ReactFlowProvider>
  );
}
