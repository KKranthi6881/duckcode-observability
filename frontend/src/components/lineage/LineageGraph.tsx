import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
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
const defaultEdgeOptions = {
  type: 'step' as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
  style: { stroke: '#94a3b8', strokeWidth: 2 }
};
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { supabase } from '../../config/supabaseClient';
import { Loader2, AlertCircle } from 'lucide-react';
import ModernModelNode from './ModernModelNode';
import { LoadMoreButton } from './ProgressiveModelLoader';

interface LineageGraphProps {
  connectionId: string;
  onDataUpdate?: (data: {
    nodes: Node[];
    edges: Edge[];
    columnLineages: any[];
  }) => void;
}

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

  const nodeWidth = 220;
  const nodeHeight = 100;

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = direction === 'LR' ? Position.Left : Position.Top;
    node.sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom;

    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

// Custom node types for ReactFlow
const nodeTypes: NodeTypes = {
  expandableModel: ModernModelNode,
};

const INITIAL_MODEL_LIMIT = 10;
const LOAD_MORE_INCREMENT = 5;

export default function LineageGraph({ connectionId, onDataUpdate }: LineageGraphProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lineageData, setLineageData] = useState<LineageData | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loadingColumns, setLoadingColumns] = useState<Set<string>>(new Set());
  const [allColumnLineages, setAllColumnLineages] = useState<any[]>([]);
  
  // All nodes and edges from API
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  
  // Progressive loading state
  const [displayLimit, setDisplayLimit] = useState(INITIAL_MODEL_LIMIT);
  
  // Visible nodes and edges based on limit
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Update visible nodes when limit changes
  useEffect(() => {
    const visibleNodes = allNodes.slice(0, displayLimit);
    const nodeIds = new Set(visibleNodes.map(n => n.id));
    const visibleEdges = allEdges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
    
    setNodes(visibleNodes);
    setEdges(visibleEdges);
  }, [allNodes, allEdges, displayLimit, setNodes, setEdges]);

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

  // Fetch columns for a model
  const fetchColumns = useCallback(async (nodeId: string) => {
    try {
      setLoadingColumns(prev => new Set(prev).add(nodeId));
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/metadata/lineage/columns/${nodeId}?limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Attach lineages to each column for easy lookup
        const columnsWithLineages = data.columns.map((column: any) => {
          // Find all lineages where this column is involved (as source or target)
          const columnLineages = data.columnLineages.filter((lineage: any) => 
            (lineage.source_object_id === nodeId && lineage.source_column === column.name) ||
            (lineage.target_object_id === nodeId && lineage.target_column === column.name)
          );
          
          return {
            ...column,
            lineages: columnLineages
          };
        });
        
        // Collect column lineages for table view
        if (data.columnLineages && data.columnLineages.length > 0) {
          setAllColumnLineages(prev => {
            // Merge new lineages, avoiding duplicates
            const existingIds = new Set(prev.map(l => 
              `${l.source_object_id}-${l.source_column}-${l.target_object_id}-${l.target_column}`
            ));
            const newLineages = data.columnLineages.filter((l: any) => 
              !existingIds.has(`${l.source_object_id}-${l.source_column}-${l.target_object_id}-${l.target_column}`)
            );
            return [...prev, ...newLineages];
          });
        }
        
        // Update node with columns
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    columns: columnsWithLineages,
                    columnLineages: data.columnLineages
                  }
                }
              : node
          )
        );
      }
    } catch (err) {
      console.error('Error fetching columns:', err);
    } finally {
      setLoadingColumns(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    }
  }, [setNodes]);

  // Generate column edges based on columnLineages
  const generateColumnEdges = useCallback((nodes: Node[]) => {
    const columnEdges: Edge[] = [];
    
    nodes.forEach((node) => {
      if (node.data.expanded && node.data.columns) {
        const lineages = node.data.columnLineages || [];
        
        lineages.forEach((lineage: any) => {
          const sourceHandle = `${lineage.source_object_id}-${lineage.source_column}-source`;
          const targetHandle = `${lineage.target_object_id}-${lineage.target_column}-target`;
          
          // Determine edge color based on confidence
          let strokeColor = '#10b981'; // green (GOLD)
          let strokeWidth = 2;
          if (lineage.confidence < 0.95) {
            strokeColor = '#3b82f6'; // blue (SILVER)
          }
          if (lineage.confidence < 0.90) {
            strokeColor = '#f59e0b'; // orange (BRONZE)
          }
          if (lineage.confidence < 0.85) {
            strokeColor = '#ef4444'; // red (LOW)
            strokeWidth = 1;
          }
          
          columnEdges.push({
            id: `col-${lineage.source_object_id}-${lineage.source_column}-${lineage.target_object_id}-${lineage.target_column}`,
            source: lineage.source_object_id,
            target: lineage.target_object_id,
            sourceHandle,
            targetHandle,
            type: 'smoothstep',
            animated: false,
            style: {
              stroke: strokeColor,
              strokeWidth,
            },
            label: `${Math.round(lineage.confidence * 100)}%`,
            labelStyle: {
              fill: strokeColor,
              fontWeight: 600,
              fontSize: 11
            },
            data: {
              transformationType: lineage.transformation_type,
              confidence: lineage.confidence
            }
          });
        });
      }
    });
    
    return columnEdges;
  }, []);

  // Handle node expansion
  const handleExpand = useCallback(async (nodeId: string) => {
    setExpandedNodes(prev => new Set(prev).add(nodeId));
    
    // Update node to show as expanded
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, expanded: true, loading: true } }
          : node
      )
    );

    // Fetch columns
    await fetchColumns(nodeId);
    
    // Remove loading state and update edges
    setNodes((nds) => {
      const updatedNodes = nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, loading: false } }
          : node
      );
      
      // Generate column edges for all expanded nodes
      const columnEdges = generateColumnEdges(updatedNodes);
      setEdges((eds) => {
        // Keep model-level edges, add column edges
        const modelEdges = eds.filter((e) => !e.id.startsWith('col-'));
        return [...modelEdges, ...columnEdges];
      });
      
      return updatedNodes;
    });
  }, [setNodes, fetchColumns, generateColumnEdges, setEdges]);

  // Handle node collapse
  const handleCollapse = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      newSet.delete(nodeId);
      return newSet;
    });
    
    setNodes((nds) => {
      const updatedNodes = nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, expanded: false } }
          : node
      );
      
      // Regenerate column edges for remaining expanded nodes
      const columnEdges = generateColumnEdges(updatedNodes);
      setEdges((eds) => {
        // Keep model-level edges, add column edges
        const modelEdges = eds.filter((e) => !e.id.startsWith('col-'));
        return [...modelEdges, ...columnEdges];
      });
      
      return updatedNodes;
    });
  }, [setNodes, generateColumnEdges, setEdges]);

  // Fetch lineage data
  useEffect(() => {
    async function fetchLineage() {
      try {
        setLoading(true);
        setError(null);

        console.log('[LineageGraph] Fetching lineage for connection:', connectionId);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Not authenticated');
          return;
        }

        const apiUrl = `${import.meta.env.VITE_API_URL}/api/metadata/lineage/model/${connectionId}`;
        console.log('[LineageGraph] API URL:', apiUrl);

        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('[LineageGraph] Response status:', response.status);

        if (!response.ok) {
          throw new Error('Failed to fetch lineage');
        }

        const data: LineageData = await response.json();
        setLineageData(data);

        // Check if there's no data
        if (!data.nodes || data.nodes.length === 0) {
          setError('No lineage data found. Please run metadata extraction first.');
          return;
        }

        // Transform to ReactFlow format
        const flowNodes: Node[] = data.nodes.map((node) => ({
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
            loading: false
          },
          position: { x: 0, y: 0 }
        }));

        const flowEdges: Edge[] = data.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: '#94a3b8',
            strokeWidth: 2
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
          label: `${Math.round(edge.confidence * 100)}%`,
          labelStyle: {
            fill: '#64748b',
            fontWeight: 600,
            fontSize: 11
          }
        }));

        // Apply layout
        const layoutedGraph = getLayoutedElements(flowNodes, flowEdges);
        setAllNodes(layoutedGraph.nodes);
        setAllEdges(layoutedGraph.edges);
        setDisplayLimit(INITIAL_MODEL_LIMIT); // Reset to initial limit on new data
      } catch (err) {
        console.error('[LineageGraph] Error fetching lineage:', err);
        setError('Failed to load lineage data');
      } finally {
        setLoading(false);
      }
    }

    if (connectionId) {
      fetchLineage();
    }
  }, [connectionId, handleExpand, handleCollapse]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2">Loading lineage...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <AlertCircle className="w-6 h-6 text-red-500" />
        <span className="ml-2 text-red-600">{error}</span>
      </div>
    );
  }

  const hasMore = displayLimit < allNodes.length;
  const remainingCount = allNodes.length - displayLimit;

  const loadMore = () => {
    setDisplayLimit(prev => Math.min(prev + LOAD_MORE_INCREMENT, allNodes.length));
  };

  return (
    <div className="w-full h-full bg-gray-50 relative">
      {lineageData && (
        <div className="p-3 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Data Lineage</h3>
              <p className="text-xs text-gray-600 mt-1">
                {lineageData.metadata.totalModels} models · {lineageData.metadata.totalDependencies} dependencies
              </p>
            </div>
            {hasMore && (
              <div className="text-xs text-gray-500 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                Showing {displayLimit} of {allNodes.length} models
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="w-full h-[calc(100%-60px)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={defaultEdgeOptions}
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
          <Background variant={BackgroundVariant.Dots} gap={14} size={1} color="#e5e7eb" />
        </ReactFlow>
        
        {/* Load More Button */}
        {hasMore && (
          <LoadMoreButton
            onClick={loadMore}
            remainingCount={remainingCount}
            currentCount={displayLimit}
            totalCount={allNodes.length}
          />
        )}
      </div>
    </div>
  );
}
