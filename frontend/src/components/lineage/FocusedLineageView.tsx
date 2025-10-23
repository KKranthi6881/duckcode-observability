import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeTypes,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  Position
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { supabase } from '../../config/supabaseClient';
import { Loader2, AlertCircle, Target, RefreshCw, Search, X } from 'lucide-react';
import ModernModelNode from './ModernModelNode';
import ExpandNode from './ExpandNode';
import ModelSelector from './ModelSelector';
import ColumnLineageView from './ColumnLineageView';

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

interface FocusedLineageViewProps {
  connectionId: string;
  initialModelId?: string;
  onDataUpdate?: (data: { nodes: Node[]; edges: Edge[]; columnLineages: ColumnLineage[] }) => void;
  hideHeader?: boolean;
}

const nodeTypes: NodeTypes = {
  expandableModel: ModernModelNode,
  expandButton: ExpandNode,
};

const defaultEdgeOptions = {
  type: 'default' as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' },
  style: { stroke: '#cbd5e1', strokeWidth: 2 }
};

interface FocusedApiNode {
  id: string;
  name: string;
  type: string;
  description?: string;
  filePath?: string;
  updatedAt?: string;
  extractionTier?: string;
  extractedFrom?: string;
  confidence?: number;
  metadata?: any;
  stats: { 
    upstreamCount: number; 
    downstreamCount: number; 
  };
  isFocal: boolean;
}

interface FocusedApiEdge {
  id: string;
  source: string;
  target: string;
}

interface FocusedLineageApiResponse {
  nodes: FocusedApiNode[];
  edges: FocusedApiEdge[];
}

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
    // Anchor edges to left/right for clean horizontal step edges
    node.targetPosition = Position.Left;
    node.sourcePosition = Position.Right;
    node.position = {
      x: nodeWithPosition.x - 150,
      y: nodeWithPosition.y - 50,
    };
  });

  return { nodes, edges };
};

// Inner component with ReactFlow context
function FocusedLineageViewContent({ connectionId, initialModelId, onDataUpdate, hideHeader }: FocusedLineageViewProps) {
  const reactFlowInstance = useReactFlow();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(initialModelId || null);
  const [selectedModelName, setSelectedModelName] = useState<string>('');
  
  // Progressive loading state - Start with only 2 to keep it simple
  const [upstreamLimit, setUpstreamLimit] = useState(2);
  const [downstreamLimit, setDownstreamLimit] = useState(2);
  const [lineageMetadata, setLineageMetadata] = useState<any>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandingDirection, setExpandingDirection] = useState<'upstream' | 'downstream' | null>(null);
  
  // Auto-load lineage if initialModelId is provided
  useEffect(() => {
    console.log('[FocusedLineageView] initialModelId:', initialModelId, 'selectedModel:', selectedModel);
    if (initialModelId) {
      console.log('[FocusedLineageView] Auto-loading lineage for:', initialModelId);
      setSelectedModel(initialModelId);
      fetchFocusedLineage(initialModelId);
    }
  }, [initialModelId]);

  // Re-fetch when limits change (for progressive loading)
  useEffect(() => {
    if (selectedModel && (upstreamLimit > 2 || downstreamLimit > 2)) {
      console.log('[FocusedLineageView] Limits changed, re-fetching lineage');
      fetchFocusedLineage(selectedModel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upstreamLimit, downstreamLimit]);

  const [allColumnLineages, setAllColumnLineages] = useState<ColumnLineage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [columnLineageView, setColumnLineageView] = useState<{
    sourceModel: { id: string; name: string; columns: Column[] };
    targetModel: { id: string; name: string; columns: Column[] };
    lineages: ColumnLineage[];
  } | null>(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Handle expanding upstream/downstream - Load 5 more at a time
  const handleExpandUpstream = useCallback(() => {
    setIsExpanding(true);
    setExpandingDirection('upstream');
    setUpstreamLimit(prev => prev + 5);
  }, []);

  const handleExpandDownstream = useCallback(() => {
    setIsExpanding(true);
    setExpandingDirection('downstream');
    setDownstreamLimit(prev => prev + 5);
  }, []);

  // Focus on a specific node
  const focusNode = useCallback((nodeId: string) => {
    const node = reactFlowInstance.getNode(nodeId);
    if (node) {
      reactFlowInstance.setCenter(
        node.position.x + 150,
        node.position.y + 50,
        { zoom: 1.5, duration: 800 }
      );
    }
  }, [reactFlowInstance]);

  // Filter nodes by search
  const filteredNodes = searchTerm
    ? nodes.filter(node => 
        node.data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.data.type.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

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
        const data: { columns: Column[]; columnLineages: ColumnLineage[] } = await response.json();
        
        const columnsWithLineages: Column[] = data.columns.map((column: Column) => {
          const columnLineages = data.columnLineages.filter((lineage: ColumnLineage) => 
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

  // Generate column edges based on columnLineages
  const generateColumnEdges = useCallback((nodes: Node[]) => {
    const columnEdges: Edge[] = [];
    
    nodes.forEach((node) => {
      if (node.data.expanded && node.data.columns) {
        const lineages = allColumnLineages.filter(
          l => l.source_object_id === node.id || l.target_object_id === node.id
        );
        
        lineages.forEach((lineage: ColumnLineage) => {
          const sourceHandle = `${lineage.source_object_id}-${lineage.source_column}-source`;
          const targetHandle = `${lineage.target_object_id}-${lineage.target_column}-target`;
          
          // Determine edge color based on confidence
          let strokeColor = '#10b981'; // green (high confidence)
          let strokeWidth = 2;
          if (lineage.confidence < 0.95) {
            strokeColor = '#3b82f6'; // blue (medium)
          }
          if (lineage.confidence < 0.90) {
            strokeColor = '#f59e0b'; // orange (low)
          }
          if (lineage.confidence < 0.85) {
            strokeColor = '#ef4444'; // red (very low)
            strokeWidth = 1;
          }
          
          columnEdges.push({
            id: lineage.id,
            source: lineage.source_object_id,
            target: lineage.target_object_id,
            sourceHandle,
            targetHandle,
            type: 'default',
            animated: false,
            style: {
              stroke: strokeColor,
              strokeWidth,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: strokeColor
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
  }, [allColumnLineages]);

  const handleExpand = useCallback(async (nodeId: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, loading: true } }
          : node
      )
    );
    await fetchColumns(nodeId);
    
    // Generate column edges after fetching columns
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
        const modelEdges = eds.filter((e) => !e.id.startsWith('col-') && !e.sourceHandle && !e.targetHandle);
        return [...modelEdges, ...columnEdges];
      });
      
      return updatedNodes;
    });
  }, [fetchColumns, generateColumnEdges, setNodes, setEdges]);

  const handleCollapse = useCallback((nodeId: string) => {
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
        const modelEdges = eds.filter((e) => !e.id.startsWith('col-') && !e.sourceHandle && !e.targetHandle);
        return [...modelEdges, ...columnEdges];
      });
      
      return updatedNodes;
    });
  }, [setNodes, generateColumnEdges, setEdges]);

  // Handle column hover for highlighting
  const handleColumnHover = useCallback((columnId: string | null, lineages: ColumnLineage[]) => {
    
    if (!columnId || lineages.length === 0) {
      // Reset all edges to default style
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          animated: false,
          style: {
            stroke: '#9ca3af',
            strokeWidth: 2
          }
        }))
      );
      return;
    }
    
    // Highlight edges related to this column
    const lineageIds = new Set(lineages.map(l => l.id));
    
    setEdges((eds) =>
      eds.map((edge) => {
        const isHighlighted = lineageIds.has(edge.id);
        return {
          ...edge,
          animated: isHighlighted,
          style: {
            stroke: isHighlighted ? '#3b82f6' : '#d1d5db',
            strokeWidth: isHighlighted ? 3 : 2,
            opacity: isHighlighted ? 1 : 0.4
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isHighlighted ? '#3b82f6' : '#d1d5db'
          }
        };
      })
    );
  }, [setEdges]);

  // Fetch focused lineage
  const fetchFocusedLineage = useCallback(async (modelId: string) => {
    try {
      // Only show loading spinner if not expanding (to avoid graph refresh)
      if (!isExpanding) {
        setLoading(true);
      }
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        setLoading(false);
        setIsExpanding(false);
        return;
      }

      console.log(`[FocusedLineage] Fetching with limits: upstream=${upstreamLimit}, downstream=${downstreamLimit}`);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/metadata/lineage/focused/${connectionId}/${modelId}?upstreamLimit=${upstreamLimit}&downstreamLimit=${downstreamLimit}`,
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

      const data: FocusedLineageApiResponse & { metadata?: any } = await response.json();
      
      // Store metadata for expand buttons
      if (data.metadata) {
        console.log('[FocusedLineage] Metadata:', data.metadata);
        setLineageMetadata(data.metadata);
      }

      if (!data.nodes || data.nodes.length === 0) {
        setError('No lineage data found for this model');
        return;
      }

      // Transform to ReactFlow format
      const flowNodes: Node[] = data.nodes.map((node: FocusedApiNode) => ({
        id: node.id,
        type: 'expandableModel',
        data: {
          id: node.id,
          name: node.name,
          type: node.type,
          description: node.description,
          filePath: node.filePath,
          updatedAt: node.updatedAt,
          extractionTier: node.extractionTier,
          extractedFrom: node.extractedFrom,
          confidence: node.confidence,
          metadata: node.metadata,
          upstreamCount: node.stats.upstreamCount,
          downstreamCount: node.stats.downstreamCount,
          stats: node.stats,
          expanded: false,
          onExpand: handleExpand,
          onCollapse: handleCollapse,
          onColumnHover: handleColumnHover,
          loading: false,
          isFocal: node.isFocal
        },
        position: { x: 0, y: 0 },
        style: node.isFocal ? {
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
        } : {}
      }));

      const flowEdges: Edge[] = data.edges.map((edge: FocusedApiEdge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'default',
        animated: false,
        style: {
          stroke: '#cbd5e1',
          strokeWidth: 2
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#cbd5e1'
        }
      }));

      // If expanding, merge with existing nodes to keep positions
      let finalNodes: Node[];
      let finalEdges: Edge[];
      
      if (isExpanding && nodes.length > 0) {
        console.log('[FocusedLineage] Expanding - merging with existing nodes');
        
        // Get existing node IDs
        const existingNodeIds = new Set(nodes.map(n => n.id));
        
        // Find only NEW nodes
        const newNodes = flowNodes.filter(n => !existingNodeIds.has(n.id));
        console.log(`[FocusedLineage] Adding ${newNodes.length} new nodes`);
        
        // Remove old expand buttons from existing nodes
        const nodesWithoutExpandButtons = nodes.filter(n => 
          n.type !== 'expandButton'
        );
        
        // Layout only the new nodes relative to existing
        const layouted = getLayoutedElements([...nodesWithoutExpandButtons, ...newNodes], [...edges, ...flowEdges]);
        finalNodes = layouted.nodes;
        finalEdges = layouted.edges;
      } else {
        // Initial load - do full layout
        const layouted = getLayoutedElements(flowNodes, flowEdges);
        finalNodes = layouted.nodes;
        finalEdges = layouted.edges;
      }

      // Reset expanding flags before rendering (so expand buttons render with correct state)
      setIsExpanding(false);
      setExpandingDirection(null);

      // Add expand nodes if there are more to load
      const focalNode = data.nodes.find((n) => n.isFocal);
      const focalNodeId = focalNode?.id;

      if (data.metadata && focalNodeId) {
        const { hasMoreUpstream, hasMoreDownstream, totalUpstreamCount, totalDownstreamCount, upstreamCount, downstreamCount } = data.metadata;

        // Add upstream expand button (cap at 5 to load incrementally)
        if (hasMoreUpstream) {
          const remainingUpstream = totalUpstreamCount - upstreamCount;
          const displayCount = Math.min(remainingUpstream, 5); // Show max 5 at a time
          console.log(`[FocusedLineage] Adding upstream expand button: ${displayCount} more nodes (${remainingUpstream} total remaining)`);
          
          finalNodes.push({
            id: 'expand-upstream',
            type: 'expandButton',
            data: {
              direction: 'upstream' as const,
              count: displayCount,
              onExpand: handleExpandUpstream,
              isLoading: expandingDirection === 'upstream'
            },
            position: { x: 0, y: 0 }
          });

          finalEdges.push({
            id: 'edge-expand-upstream',
            source: 'expand-upstream',
            target: focalNodeId,
            type: 'default',
            animated: false,
            style: { stroke: '#cbd5e1', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' }
          });
        }

        // Add downstream expand button (cap at 5 to load incrementally)
        if (hasMoreDownstream) {
          const remainingDownstream = totalDownstreamCount - downstreamCount;
          const displayCount = Math.min(remainingDownstream, 5); // Show max 5 at a time
          console.log(`[FocusedLineage] Adding downstream expand button: ${displayCount} more nodes (${remainingDownstream} total remaining)`);
          
          finalNodes.push({
            id: 'expand-downstream',
            type: 'expandButton',
            data: {
              direction: 'downstream' as const,
              count: displayCount,
              onExpand: handleExpandDownstream,
              isLoading: expandingDirection === 'downstream'
            },
            position: { x: 0, y: 0 }
          });

          finalEdges.push({
            id: 'edge-expand-downstream',
            source: focalNodeId,
            target: 'expand-downstream',
            type: 'default',
            animated: false,
            style: { stroke: '#cbd5e1', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' }
          });
        }

        // Re-layout with expand nodes if any were added
        if (hasMoreUpstream || hasMoreDownstream) {
          const finalLayout = getLayoutedElements(finalNodes, finalEdges);
          finalNodes = finalLayout.nodes;
          finalEdges = finalLayout.edges;
        }
      }

      setNodes(finalNodes);
      setEdges(finalEdges);

      const focal = data.nodes.find((n) => n.isFocal);
      if (focal) {
        handleExpand(focal.id);
      }

    } catch (err) {
      console.error('[FocusedLineage] Error:', err);
      setError('Failed to load lineage data');
      setIsExpanding(false); // Reset on error
      setExpandingDirection(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, handleExpand, handleCollapse, handleColumnHover, handleExpandUpstream, handleExpandDownstream, setNodes, setEdges, upstreamLimit, downstreamLimit, isExpanding]);

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
      {!hideHeader && (
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
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search models..."
              className="w-64 pl-9 pr-9 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Search Results Dropdown */}
            {searchTerm && filteredNodes.length > 0 && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setSearchTerm('')}
                />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-20 max-h-96 overflow-y-auto">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <div className="text-xs font-semibold text-gray-600 uppercase">
                      {filteredNodes.length} model{filteredNodes.length !== 1 ? 's' : ''} found
                    </div>
                  </div>
                  {filteredNodes.map((node) => (
                    <button
                      key={node.id}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent event bubbling
                        setSearchTerm(''); // Clear search to hide dropdown
                        setTimeout(() => focusNode(node.id), 0); // Focus after state update
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-blue-50 flex items-center justify-between group"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">
                          {node.data.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 capitalize">{node.data.type}</div>
                      </div>
                      {node.data.isFocal && (
                        <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                          FOCAL
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => fetchFocusedLineage(selectedModel)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>
      )}

      {/* Graph */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          defaultEdgeOptions={defaultEdgeOptions}
          fitViewOptions={{ padding: 0.2 }}
          onEdgeClick={(_event, edge) => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            
            if (sourceNode?.data.columns && targetNode?.data.columns) {
              // Get lineages between these two models
              const relevantLineages = allColumnLineages.filter(
                l => l.source_object_id === edge.source && l.target_object_id === edge.target
              );
              
              setColumnLineageView({
                sourceModel: {
                  id: sourceNode.id,
                  name: sourceNode.data.name,
                  columns: sourceNode.data.columns
                },
                targetModel: {
                  id: targetNode.id,
                  name: targetNode.data.name,
                  columns: targetNode.data.columns
                },
                lineages: relevantLineages
              });
            }
          }}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#e5e7eb" />
        </ReactFlow>
      </div>

      {/* Column Lineage View Modal */}
      {columnLineageView && (
        <ColumnLineageView
          sourceModel={columnLineageView.sourceModel}
          targetModel={columnLineageView.targetModel}
          lineages={columnLineageView.lineages}
          onClose={() => setColumnLineageView(null)}
        />
      )}
    </div>
  );
}

// Wrapper with ReactFlowProvider
export default function FocusedLineageView(props: FocusedLineageViewProps) {
  return (
    <ReactFlowProvider>
      <FocusedLineageViewContent {...props} />
    </ReactFlowProvider>
  );
}
